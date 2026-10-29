/**
 * Notification & SMS Dispatch Mock Service
 * Can be replaced with CDAC / NIC SMS Gateway in production.
 */

import { FDR, NotificationItem, SystemSettings } from '../../types';

export class NotificationService {
  /**
   * Simulate SMS dispatch to Indian mobile
   */
  static simulateSMSDispatch(mobileMasked: string, message: string): { sent: boolean; messageId: string } {
    console.log(`[SMS-GATEWAY] Dispatched to ${mobileMasked}: "${message}"`);
    return {
      sent: true,
      messageId: `SMS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    };
  }

  /**
   * Generate automated maturity reminders based on system alert settings (30 / 60 / 90 days)
   */
  static evaluateMaturityAlerts(
    fdrs: FDR[],
    settings: SystemSettings = { alertRules: { days90: true, days60: true, days30: true }, autoVerifyEnabled: true, maxLienDurationYears: 10 }
  ): NotificationItem[] {
    const generated: NotificationItem[] = [];
    const now = new Date();

    for (const fdr of fdrs) {
      if (fdr.status === 'Released') continue;
      
      const maturity = new Date(fdr.maturityDate);
      const diffTime = maturity.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30 && diffDays > 0 && settings.alertRules.days30) {
        generated.push({
          id: `NOTIF-MAT-30-${fdr.id}`,
          recipientRole: 'institution',
          institutionId: fdr.institutionId,
          title: `Action Required: FDR ${fdr.trackingId} Matures in ${diffDays} Days`,
          message: `Your Security Deposit FDR #${fdr.fdrNumber} (₹${fdr.amount.toLocaleString('en-IN')}) with ${fdr.bankName} matures on ${fdr.maturityDate}. Please initiate Renewal or Lien Release request.`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'alert',
          link: fdr.id,
        });
      } else if (diffDays <= 60 && diffDays > 30 && settings.alertRules.days60) {
        generated.push({
          id: `NOTIF-MAT-60-${fdr.id}`,
          recipientRole: 'institution',
          institutionId: fdr.institutionId,
          title: `Advance Notice: FDR ${fdr.trackingId} Matures in ${diffDays} Days`,
          message: `Fixed Deposit ${fdr.fdrNumber} at ${fdr.bankName} is scheduled to mature on ${fdr.maturityDate}. Prepare compliance documents.`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'reminder',
          link: fdr.id,
        });
      } else if (diffDays <= 90 && diffDays > 60 && settings.alertRules.days90) {
        generated.push({
          id: `NOTIF-MAT-90-${fdr.id}`,
          recipientRole: 'institution',
          institutionId: fdr.institutionId,
          title: `Compliance Advisory: 90-Day FDR Maturity Window`,
          message: `FDR #${fdr.fdrNumber} entered the 90-day maturity advisory window.`,
          timestamp: new Date().toISOString(),
          read: true,
          type: 'reminder',
          link: fdr.id,
        });
      }
    }

    return generated;
  }
}
