package com.payablestracker.sms
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL

class SmsForwardWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val message = inputData.getString(KEY_MESSAGE) ?: return Result.failure()
        val sender = inputData.getString(KEY_SENDER).orEmpty()
        // Never put the long-lived capture token in WorkManager's persisted input database.
        val token = TokenStore.get(applicationContext) ?: return Result.failure()
        return try {
            val endpoint = BuildConfig.SUPABASE_URL.trimEnd('/') + "/functions/v1/sms-capture/capture"
            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"; connectTimeout = 15000; readTimeout = 20000; doOutput = true
                setRequestProperty("apikey", BuildConfig.SUPABASE_PUBLISHABLE_KEY)
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            val payload = """{"message":${jsonString(message)},"sender":${jsonString(sender)}}"""
            connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status in 200..299) Result.success()
            else if (status == 401 || status == 403 || status in 400..499) Result.failure()
            else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }
    private fun jsonString(value: String): String = buildString {
        append('"')
        value.forEach { c ->
            when (c) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (c.code < 0x20) append("\\u%04x".format(c.code)) else append(c)
            }
        }
        append('"')
    }
    companion object {
        const val KEY_MESSAGE = "sms_message"
        const val KEY_SENDER = "sms_sender"
    }
}
