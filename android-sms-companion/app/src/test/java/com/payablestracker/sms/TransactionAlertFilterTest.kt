package com.payablestracker.sms

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TransactionAlertFilterTest {
    @Test fun acceptsBankDebitAlert() {
        assertTrue(TransactionAlertFilter.isTransactionAlert("Your A/c XX157 debited for Rs 9140.00 on 21-Nov"))
    }
    @Test fun acceptsUpiCreditAlert() {
        assertTrue(TransactionAlertFilter.isTransactionAlert("INR 2,500 credited to your account"))
    }
    @Test fun rejectsOtpEvenWhenAmountAppears() {
        assertFalse(TransactionAlertFilter.isTransactionAlert("Your OTP 123456 for Rs 500"))
    }
    @Test fun rejectsNonTransactionNotification() {
        assertFalse(TransactionAlertFilter.isTransactionAlert("Your monthly statement is ready"))
    }
}
