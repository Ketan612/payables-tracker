package com.payablestracker.sms

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.security.MessageDigest

object TransactionNotificationQueue {
    fun enqueue(context: Context, sender: String, message: String, eventIdentity: String) {
        if (TokenStore.get(context).isNullOrBlank() || !TokenStore.hasConsent(context)) return
        val body = message.trim()
        if (body.length !in 5..4000 || !TransactionAlertFilter.isTransactionAlert(body)) return
        val digest = MessageDigest.getInstance("SHA-256")
            .digest((sender + "|" + body + "|" + eventIdentity).toByteArray())
            .joinToString("") { "%02x".format(it) }
        val input = Data.Builder()
            .putString(SmsForwardWorker.KEY_MESSAGE, TokenStore.encryptQueuedValue(body))
            .putString(SmsForwardWorker.KEY_SENDER, TokenStore.encryptQueuedValue(sender))
            .build()
        val request = OneTimeWorkRequestBuilder<SmsForwardWorker>()
            .setInputData(input)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("notification-forward-$digest", ExistingWorkPolicy.KEEP, request)
    }
}
