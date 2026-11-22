package com.payablestracker.sms
import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var tokenInput: EditText
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(28, 36, 28, 28); gravity = Gravity.CENTER_VERTICAL
        }
        root.addView(TextView(this).apply { text = "Payables Tracker"; textSize = 25f })
        root.addView(TextView(this).apply { text = "SMS Companion"; textSize = 18f })
        root.addView(TextView(this).apply {
            text = "Paste the capture token generated from Payables Tracker → SMS Monitor. The token is encrypted on this device."
            textSize = 14f; setPadding(0, 18, 0, 18)
        })
        tokenInput = EditText(this).apply { hint = "Paste pairing token"; singleLine = true
            setText(TokenStore.get(this@MainActivity).orEmpty()) }
        root.addView(tokenInput)
        root.addView(Button(this).apply {
            text = "Save token"
            setOnClickListener {
                val token = tokenInput.text.toString().trim()
                if (token.length < 32) status.text = "Invalid token. Generate a new one from SMS Monitor."
                else { TokenStore.save(this@MainActivity, token); status.text = "Token saved securely."; refreshStatus() }
            }
        })
        root.addView(Button(this).apply {
            text = "Grant SMS access"
            setOnClickListener {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECEIVE_SMS)
                    != PackageManager.PERMISSION_GRANTED)
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_SMS)
                else refreshStatus()
            }
        })
        status = TextView(this).apply { textSize = 14f; setPadding(0, 22, 0, 0) }
        root.addView(status)
        setContentView(root); refreshStatus()
    }
    private fun refreshStatus() {
        val hasToken = TokenStore.get(this) != null
        val hasPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        status.text = when {
            !hasToken -> "Setup incomplete: enter your pairing token."
            !hasPermission -> "Token saved. SMS permission is not granted."
            else -> "Connected. Listening for incoming credit/debit transaction SMS."
        }
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_SMS) refreshStatus()
    }
    companion object { private const val REQUEST_SMS = 4102 }
}
