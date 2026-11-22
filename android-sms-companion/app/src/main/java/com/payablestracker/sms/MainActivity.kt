package com.payablestracker.sms
import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

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
        root.addView(TextView(this).apply { text = "SMS Companion"; textSize = 18f })
        root.addView(TextView(this).apply {
            text = "Connect this Android device to your Payables Tracker account using the one-time token from SMS Monitor."
            textSize = 14f
            setPadding(0, 18, 0, 12)
        })
        tokenInput = EditText(this).apply {
            hint = "Paste Android capture token"
            singleLine = true
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
        consentToggle = CheckBox(this).apply {
            text = "I agree: monitor incoming bank/UPI credit and debit alerts only. Matching SMS text and sender will be sent over HTTPS to my Payables Tracker account. OTP and non-transaction messages are filtered out. I can stop forwarding by unchecking this box."
            textSize = 13f
            isChecked = TokenStore.hasConsent(this@MainActivity)
            setOnCheckedChangeListener { _, accepted ->
                TokenStore.setConsent(this@MainActivity, accepted)
                refreshStatus()
            }
        }
        root.addView(consentToggle)
        root.addView(Button(this).apply {
            text = "Grant SMS access"
            setOnClickListener {
                if (TokenStore.get(this@MainActivity).isNullOrBlank()) {
                    status.text = "Save your Android token first."
                } else if (!consentToggle.isChecked) {
                    status.text = "Please review and accept the SMS forwarding disclosure first."
                } else if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECEIVE_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                        this@MainActivity, arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_SMS
                    )
                } else refreshStatus()
            }
        })
        status = TextView(this).apply {
            textSize = 14f
            setPadding(0, 22, 0, 0)
        }
        root.addView(status)
        setContentView(root)
        refreshStatus()
    }

    private fun refreshStatus() {
        val hasToken = TokenStore.get(this) != null
        val hasPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED
        status.text = when {
            !hasToken -> "Setup incomplete: enter and save your Android token."
            !consentToggle.isChecked -> "Forwarding is paused until you accept the disclosure."
            !hasPermission -> "SMS permission is unavailable. RECEIVE_SMS is hard-restricted by Android; an APK installed outside an allowlisting installer may not be granted this permission."
            else -> "Connected. Listening for incoming credit/debit transaction SMS."
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_SMS) refreshStatus()
    }

    companion object { private const val REQUEST_SMS = 4102 }
}
