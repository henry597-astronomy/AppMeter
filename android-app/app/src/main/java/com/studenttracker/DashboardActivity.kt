package com.studenttracker

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

class DashboardActivity : AppCompatActivity() {

    private val scope = CoroutineScope(Dispatchers.IO)
    private val SUPABASE_URL = "https://jcrodmrmuaegvcymbpog.supabase.co"
    private val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjcm9kbXJtdWFlZ3ZjeW1icG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzAyOTYsImV4cCI6MjA5NDcwNjI5Nn0.aH7OComWskJn9iC3UXGQCCogknqbrrt4rYDD23UZYzg"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        val listView = findViewById<ListView>(R.id.usageListView)
        val totalTimeText = findViewById<TextView>(R.id.totalTimeText)
        val logoutButton = findViewById<Button>(R.id.logoutButton)

        loadUsageData(listView, totalTimeText)

        logoutButton.setOnClickListener {
            getSharedPreferences("tracker_prefs", MODE_PRIVATE).edit().clear().apply()
            stopService(Intent(this, TrackingService::class.java))
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }

    private fun loadUsageData(listView: ListView, totalTimeText: TextView) {
        val prefs = getSharedPreferences("tracker_prefs", Context.MODE_PRIVATE)
        val studentId = prefs.getString("student_id", "") ?: return
        val token = prefs.getString("auth_token", "") ?: return

        scope.launch {
            try {
                val url = URL("$SUPABASE_URL/rest/v1/usage_records?student_id=eq.$studentId&order=start_time.desc&limit=50")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("apikey", ANON_KEY)
                conn.setRequestProperty("Authorization", "Bearer $token")

                val response = conn.inputStream.bufferedReader().readText()
                val records = JSONArray(response)

                val appMap = mutableMapOf<String, Int>()
                for (i in 0 until records.length()) {
                    val record = records.getJSONObject(i)
                    val appName = record.getString("app_name").split(".").last()
                    val duration = record.optInt("duration_seconds", 0)
                    appMap[appName] = (appMap[appName] ?: 0) + duration
                }

                val sortedApps = appMap.entries.sortedByDescending { it.value }
                val displayList = sortedApps.map { "${it.key}  —  ${formatTime(it.value)}" }
                val totalSeconds = appMap.values.sum()

                withContext(Dispatchers.Main) {
                    totalTimeText.text = "Total Screen Time: ${formatTime(totalSeconds)}"
                    listView.adapter = ArrayAdapter(
                        this@DashboardActivity,
                        android.R.layout.simple_list_item_1,
                        displayList
                    )
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@DashboardActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun formatTime(seconds: Int): String {
        val h = seconds / 3600
        val m = (seconds % 3600) / 60
        val s = seconds % 60
        return when {
            h > 0 -> "${h}h ${m}m"
            m > 0 -> "${m}m ${s}s"
            else -> "${s}s"
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
