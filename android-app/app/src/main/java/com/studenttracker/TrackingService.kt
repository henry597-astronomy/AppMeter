package com.studenttracker

import android.app.*
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.*
import java.util.Date

class TrackingService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var lastApp = ""
    private var sessionStart = 0L
    private val scope = CoroutineScope(Dispatchers.IO)

    private val checkRunnable = object : Runnable {
        override fun run() {
            checkForegroundApp()
            handler.postDelayed(this, 5000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundNotification()
        handler.post(checkRunnable)
        return START_STICKY
    }

    private fun checkForegroundApp() {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val endTime = System.currentTimeMillis()
        val startTime = endTime - 10000

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, startTime, endTime
        )

        val currentApp = stats
            ?.filter { it.lastTimeUsed > 0 }
            ?.maxByOrNull { it.lastTimeUsed }
            ?.packageName ?: return

        if (currentApp != lastApp) {
            if (lastApp.isNotEmpty() && sessionStart > 0) {
                val duration = ((System.currentTimeMillis() - sessionStart) / 1000).toInt()
                if (duration > 3) {
                    saveUsageRecord(lastApp, Date(sessionStart), Date(), duration)
                }
            }
            lastApp = currentApp
            sessionStart = System.currentTimeMillis()
        }
    }

    private fun saveUsageRecord(appName: String, start: Date, end: Date, duration: Int) {
        val prefs = getSharedPreferences("tracker_prefs", Context.MODE_PRIVATE)
        val studentId = prefs.getString("student_id", "") ?: return
        val token = prefs.getString("auth_token", "") ?: return

        scope.launch {
            try {
                SupabaseClient.insertUsageRecord(
                    studentId = studentId,
                    token = token,
                    appName = appName,
                    startTime = start,
                    endTime = end,
                    durationSeconds = duration
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun startForegroundNotification() {
        val channelId = "tracking_channel"
        val channel = NotificationChannel(
            channelId, "App Tracking", NotificationManager.IMPORTANCE_LOW
        )
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)

        val notification = Notification.Builder(this, channelId)
            .setContentTitle("Tracking Active")
            .setContentText("App usage is being recorded")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .build()

        startForeground(1, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(checkRunnable)
        scope.cancel()
        super.onDestroy()
    }
}
