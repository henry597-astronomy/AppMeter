package com.studenttracker

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

class ConsentActivity : AppCompatActivity() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_consent)

        val agreeButton = findViewById<Button>(R.id.agreeButton)
        val revokeButton = findViewById<Button>(R.id.revokeButton)

        agreeButton.setOnClickListener {
            if (!hasUsagePermission()) {
                Toast.makeText(this,
                    "Please find Student Tracker in the list and turn it ON, then come back",
                    Toast.LENGTH_LONG).show()
                startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            } else {
                giveConsent()
            }
        }

        revokeButton.setOnClickListener {
            revokeConsent()
        }
    }

    override fun onResume() {
        super.onResume()
        if (hasUsagePermission()) {
            giveConsent()
        }
    }

    private fun hasUsagePermission(): Boolean {
        return try {
            val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            false
        }
    }

    private fun giveConsent() {
        val prefs = getSharedPreferences("tracker_prefs", MODE_PRIVATE)
        val studentId = prefs.getString("student_id", "") ?: return
        val token = prefs.getString("auth_token", "") ?: return

        scope.launch {
            try {
                SupabaseClient.updateConsent(studentId, token, true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            withContext(Dispatchers.Main) {
                val serviceIntent = Intent(this@ConsentActivity, TrackingService::class.java)
                startForegroundService(serviceIntent)
                Toast.makeText(this@ConsentActivity,
                    "Tracking started successfully!",
                    Toast.LENGTH_SHORT).show()
                startActivity(Intent(this@ConsentActivity, DashboardActivity::class.java))
                finish()
            }
        }
    }

    private fun revokeConsent() {
        val prefs = getSharedPreferences("tracker_prefs", MODE_PRIVATE)
        val studentId = prefs.getString("student_id", "") ?: return
        val token = prefs.getString("auth_token", "") ?: return

        scope.launch {
            try {
                SupabaseClient.updateConsent(studentId, token, false)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            withContext(Dispatchers.Main) {
                stopService(Intent(this@ConsentActivity, TrackingService::class.java))
                prefs.edit().clear().apply()
                Toast.makeText(this@ConsentActivity,
                    "Tracking stopped and data deleted",
                    Toast.LENGTH_SHORT).show()
                startActivity(Intent(this@ConsentActivity, MainActivity::class.java))
                finish()
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
