package com.payablestracker.sms

object TransactionAlertFilter {
    fun isTransactionAlert(message: String): Boolean {
        val text = message.lowercase()
        if (listOf("otp", "one time password", "verification code", "login code", "authentication code").any(text::contains)) return false
        val hasAmount = Regex("""(?:₹|\binr\b|\brs\.?\s*)\s?[\d,]+(?:\.\d{1,2})?""").containsMatchIn(text)
        val transactionVerb = Regex("""\b(credited|debited|credit|debit|spent|paid|sent|withdrawn|deposited|received|refund|cashback|transferred|purchase)\b""").containsMatchIn(text)
        return hasAmount && transactionVerb
    }
}
