import cron from 'node-cron';
import { config } from '../config/index.js';
import { orderService } from './order.js';
import { emailService } from './email.js';

export function initCronJobs(): void {
  // Send 1st reminder (after 1 hour) - runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running 1st reminder check...');
    await sendFirstReminders();
  });

  // Send 2nd reminder (after 24 hours) - runs every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running 2nd reminder check...');
    await sendSecondReminders();
  });

  // Expire old pending orders (after 72 hours) - runs every hour
  cron.schedule('30 * * * *', async () => {
    console.log('Running pending orders expire check...');
    await expireOldPendingOrders();
  });

  console.log('Cron jobs scheduled:');
  console.log(`  - 1st reminder: after ${config.cron.firstReminderHours}h`);
  console.log(`  - 2nd reminder: after ${config.cron.secondReminderHours}h`);
  console.log(`  - Expire: after ${config.cron.pendingExpireHours}h`);
}

// Send 1st reminder (soft, "Забыли оплатить?")
async function sendFirstReminders(): Promise<void> {
  try {
    const orders = await orderService.getPendingOrdersForFirstReminder(
      config.cron.firstReminderHours
    );

    if (orders.length > 0) {
      console.log(`Found ${orders.length} orders for 1st reminder`);
    }

    for (const order of orders) {
      const sent = await emailService.sendFirstReminder(order);
      if (sent) {
        await orderService.incrementReminderCount(order.id);
        console.log(`1st reminder sent for order ${order.order_number}`);
      }
    }
  } catch (error) {
    console.error('Send 1st reminders error:', error);
  }
}

// Send 2nd reminder (urgency, "Билеты ещё ждут!")
async function sendSecondReminders(): Promise<void> {
  try {
    const orders = await orderService.getPendingOrdersForSecondReminder(
      config.cron.secondReminderHours
    );

    if (orders.length > 0) {
      console.log(`Found ${orders.length} orders for 2nd reminder`);
    }

    for (const order of orders) {
      const sent = await emailService.sendSecondReminder(order);
      if (sent) {
        await orderService.incrementReminderCount(order.id);
        console.log(`2nd reminder sent for order ${order.order_number}`);
      }
    }
  } catch (error) {
    console.error('Send 2nd reminders error:', error);
  }
}

// Expire orders that are still pending after 72 hours
async function expireOldPendingOrders(): Promise<void> {
  try {
    const expiredCount = await orderService.expireOldPendingOrders(
      config.cron.pendingExpireHours
    );
    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} old pending orders`);
    }
  } catch (error) {
    console.error('Expire old pending orders error:', error);
  }
}
