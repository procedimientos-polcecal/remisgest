const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// Corre todos los días a las 19:00 hora Argentina (UTC-3 = 22:00 UTC)
exports.notificarRemisesDiarios = onSchedule(
  { schedule: '0 22 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    // Fecha de mañana en Argentina
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    // Obtener todos los orgs (admins)
    const orgsSnap = await db.collection('orgs').get();

    for (const orgDoc of orgsSnap.docs) {
      const adminUid = orgDoc.id;
      let orgData;
      try {
        orgData = JSON.parse(orgDoc.data().state || '{}');
      } catch { continue; }

      const employees = orgData.employees || [];
      const shifts = orgData.shifts || [];
      const routes = orgData.routes || {};

      // Buscar todas las rutas del día de mañana en este org
      const routesForDay = Object.entries(routes)
        .filter(([key]) => key.startsWith(iso + '__'));

      // Agrupar asignaciones por empleado
      const empAssignments = {}; // empId → [{shift, route}]

      for (const [key, routeList] of routesForDay) {
        const shiftId = key.split('__')[1];
        const shift = shifts.find(s => s.id === shiftId);
        if (!Array.isArray(routeList)) continue;
        for (const route of routeList) {
          if (!Array.isArray(route.seats)) continue;
          for (const seat of route.seats) {
            if (!seat.empId) continue;
            if (!empAssignments[seat.empId]) empAssignments[seat.empId] = [];
            empAssignments[seat.empId].push({ shift, route });
          }
        }
      }

      // Enviar notificación a cada empleado asignado
      for (const [empId, assignments] of Object.entries(empAssignments)) {
        const emp = employees.find(e => e.id === empId);
        if (!emp?.email) continue;

        // Obtener UID del empleado desde empAccounts
        const empAccountSnap = await db.collection('empAccounts')
          .doc(emp.email.toLowerCase()).get();
        if (!empAccountSnap.exists) continue;
        const empUid = empAccountSnap.data().uid;
        if (!empUid) continue;

        // Obtener token FCM
        const tokenSnap = await db.collection('fcmTokens').doc(empUid).get();
        if (!tokenSnap.exists) continue;
        const fcmToken = tokenSnap.data().token;
        if (!fcmToken) continue;

        // Armar mensaje
        const firstAssign = assignments[0];
        const vehicleName = firstAssign.route?.vehicle?.name || 'tu remis';
        const departureTime = firstAssign.route?.departureTime || '';
        const shiftName = firstAssign.shift?.name || '';
        const fmtDate = iso.split('-').reverse().join('/');

        const title = `Remis para mañana ${fmtDate}`;
        const body = [
          `${shiftName ? shiftName + ' — ' : ''}${vehicleName}`,
          departureTime ? `Búsqueda: ${departureTime}` : '',
          assignments.length > 1 ? `(${assignments.length} remises asignados)` : ''
        ].filter(Boolean).join('\n');

        try {
          await messaging.send({
            token: fcmToken,
            notification: { title, body },
            data: { empId, adminUid, date: iso },
            android: { priority: 'high' },
            webpush: {
              notification: { icon: '/logo-pp.png', badge: '/logo-pp.png' },
              fcmOptions: { link: 'https://remisgest.web.app/' }
            }
          });
          console.log(`Notificación enviada a ${emp.email}`);
        } catch (e) {
          console.warn(`Error enviando a ${emp.email}:`, e.message);
          // Si el token es inválido, eliminarlo
          if (e.code === 'messaging/registration-token-not-registered') {
            await db.collection('fcmTokens').doc(empUid).delete();
          }
        }
      }
    }

    console.log('Notificaciones diarias completadas');
  }
);
