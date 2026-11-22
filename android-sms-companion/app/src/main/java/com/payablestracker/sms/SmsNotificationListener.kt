package com.payablestracker.sms

import android.app.Notification
import android.content.ComponentName
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class SmsNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)
        if (!TokenStore.hasConsent(this) || TokenStore.get(this).isNullOrBlank()) return
        // Notification Access is broad at OS level; only the selected default SMS app is processed.
        val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(this) ?: return
        if (sbn.packageName != defaultSmsPackage) return
        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val text = buildString {
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.let { append(it) }
            if (isBlank()) extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.let { append(it) }
            if (isBlank()) extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach { line ->
                if (isNotEmpty()) append("\n")
                append(line)
            }
        }.trim()
        if (text.isBlank()) return
        val sender = title.ifBlank { sbn.packageName }
        val identity = "${sbn.key}|${sbn.postTime}|${sbn.id}"
        TransactionNotificationQueue.enqueue(this, sender, text, identity)
    }

    companion object {
        fun isEnabled(context: android.content.Context): Boolean {
            val enabled = android.provider.Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
            val component = ComponentName(context, SmsNotificationListener::class.java)
            return enabled.split(':').any { it.equals(component.flattenToString(), ignoreCase = true) }
        }
    }
}
