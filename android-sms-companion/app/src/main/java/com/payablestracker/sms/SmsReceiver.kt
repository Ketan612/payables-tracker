package com.payablestracker.sms
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.security.MessageDigest

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val token = TokenStore.get(context) ?: return
        Telephony.Sms.Intents.getMessagesFromIntent(intent).forEach { sms ->
            val body = sms.messageBody.orEmpty().trim()
            val sender = sms.originatingAddress.orEmpty()
            if (body.length !in 5..4000 || !isTransactionAlert(body)) return@forEach
            val digest = MessageDigest.getInstance("SHA-256")
                .digest((sender + "|" + body + "|" + sms.timestampMillis).toByteArray())
                .joinToString("") { "%02x".format(it) }
            val input = Data.Builder().putString(SmsForwardWorker.KEY_MESSAGE, body)
                .putString(SmsForwardWorker.KEY_SENDER, sender)
                .putString(SmsForwardWorker.KEY_TOKEN, token).build()
            val request = OneTimeWorkRequestBuilder<SmsForwardWorker>()
                .setInputData(input)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "sms-forward-$digest", ExistingWorkPolicy.KEEP, request)
        }
    }
    private fun isTransactionAlert(message: String): Boolean {
        val text = message.lowercase()
        if (listOf("otp", "one time password", "verification code", "login code", "do not share")
            .any(text::contains)) return false
        val debit = listOf("debited", "debit", "spent", "purchase", "withdrawn", "payment of")
        val credit = listOf("credited", "credit", "received", "deposited")
        return debit.any(text::contains) || credit.any(text::contains)
    }
}
