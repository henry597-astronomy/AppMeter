package com.studenttracker.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.studenttracker.TrackingService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val serviceIntent = Intent(context, TrackingService::class.java)
            context.startForegroundService(serviceIntent)
        }
    }
}
