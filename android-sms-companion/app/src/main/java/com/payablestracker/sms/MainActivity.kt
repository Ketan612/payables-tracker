package com.payablestracker.sms

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.net.Uri

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var tokenInput: EditText
    private lateinit var consentToggle: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 36, 28, 28)
            gravity = Gravity.CENTER_VERTICAL
        }
        root.addView(TextView(this).apply { text = "Payables Tracker"; textSize = 25f })
        root.addView(TextView(this).apply { text = "SMS Notification Companion"; textSize = 18f })
        root.addView(TextView(this).apply {
            text = "Connect this Android device using the one-time token from SMS Monitor."
            textSize = 14f
            setPadding(0, 18, 0, 12)
        })
        tokenInput = EditText(this).apply {
            hint = "Paste Android capture token"
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setText(TokenStore.get(this@MainActivity).orEmpty())
        }
        root.addView(tokenInput)
        root.addView(Button(this).apply {
            text = "Save token"
            setOnClickListener {
                val token = tokenInput.text.toString().trim()
                if (token.length < 32) status.text = "Invalid token. Generate a new one from SMS Monitor."
                else {
                    TokenStore.save(this@MainActivity, token)
                    status.text = "Token saved securely on this device."
                    refreshStatus()
                }
            }
        })
        root.addView(TextView(this).apply { text = "NOTIFICATION DATA DISCLOSURE"; textSize = 14f; setPadding(0, 20, 0, 6) })
        root.addView(TextView(this).apply {
            text = "When you opt in and enable Android Notification Access, this app can technically receive notification content from apps on your device. This app processes notifications only from Android's currently selected default SMS app, filters for bank/UPI credit and debit transaction alerts, and attempts to exclude OTP/authentication messages. Matching notification text and its conversation title are sent over HTTPS to your Payables Tracker account for transaction capture, duplicate detection, account mapping, and Cash Book/review processing. It does not read your SMS inbox or history. Filtering is best-effort; review captured entries. You can stop forwarding by turning off consent or Notification Access."
            textSize = 13f
            setPadding(0, 0, 0, 8)
        })
        root.addView(TextView(this).apply {
            text = "Read the Android notification capture Privacy Notice"
            textSize = 14f
            setPadding(0, 0, 0, 10)
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL))) }
        })
        consentToggle = CheckBox(this).apply {
            text = "I have read the disclosure and agree to forward matching new transaction SMS notifications to my Payables Tracker account."
            textSize = 13f
            isChecked = TokenStore.hasConsent(this@MainActivity)
            setOnCheckedChangeListener { _, accepted -> TokenStore.setConsent(this@MainActivity, accepted); refreshStatus() }
        }
        root.addView(consentToggle)
        root.addView(Button(this).apply {
            text = "Enable notification access"
            setOnClickListener {
                if (TokenStore.get(this@MainActivity).isNullOrBlank()) status.text = "Save your Android token first."
                else if (!consentToggle.isChecked) status.text = "Please read and accept the notification data disclosure first."
                else startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        })
        status = TextView(this).apply { textSize = 14f; setPadding(0, 22, 0, 0) }
        root.addView(status)
        setContentView(ScrollView(this).apply { addView(root) })
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) refreshStatus()
    }

    private fun refreshStatus() {
        val hasToken = TokenStore.get(this) != null
        status.text = when {
            !hasToken -> "Setup incomplete: enter and save your Android token."
            !consentToggle.isChecked -> "Forwarding is paused until you accept the disclosure."
            !SmsNotificationListener.isEnabled(this) -> "Notification Access is not enabled. Enable Payables Tracker in Android Notification Access settings."
            else -> "Ready. Listening for new notifications from your default SMS app and filtering transaction alerts."
        }
    }

    companion object {
        private const val PRIVACY_URL = "https://payables-tracker-ten.vercel.app/privacy-android-sms.html"
    }
}
