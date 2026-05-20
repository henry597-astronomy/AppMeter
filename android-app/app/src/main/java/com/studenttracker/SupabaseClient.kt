package com.studenttracker

import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import org.json.JSONObject

object SupabaseClient {

    private const val SUPABASE_URL = "https://jcrodmrmuaegvcymbpog.supabase.co"
    private const val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjcm9kbXJtdWFlZ3ZjeW1icG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzAyOTYsImV4cCI6MjA5NDcwNjI5Nn0.aH7OComWskJn9iC3UXGQCCogknqbrrt4rYDD23UZYzg"

    fun signIn(email: String, password: String): JSONObject {
        val url = URL("$SUPABASE_URL/auth/v1/token?grant_type=password")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("apikey", ANON_KEY)
        conn.doOutput = true
        val body = JSONObject()
        body.put("email", email)
        body.put("password", password)
        conn.outputStream.write(body.toString().toByteArray())
        val response = conn.inputStream.bufferedReader().readText()
        return JSONObject(response)
    }

    fun signUp(email: String, password: String, fullName: String, role: String, grade: String = ""): JSONObject {
        val url = URL("$SUPABASE_URL/auth/v1/signup")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("apikey", ANON_KEY)
        conn.doOutput = true
        val metadata = JSONObject()
        metadata.put("full_name", fullName)
        metadata.put("role", role)
        metadata.put("grade", grade)
        val body = JSONObject()
        body.put("email", email)
        body.put("password", password)
        body.put("data", metadata)
        conn.outputStream.write(body.toString().toByteArray())
        val response = conn.inputStream.bufferedReader().readText()
        return JSONObject(response)
    }

    fun insertUsageRecord(
        studentId: String,
        token: String,
        appName: String,
        startTime: Date,
        endTime: Date,
        durationSeconds: Int
    ) {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        val url = URL("$SUPABASE_URL/rest/v1/usage_records")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("apikey", ANON_KEY)
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.doOutput = true
        val body = JSONObject()
        body.put("student_id", studentId)
        body.put("app_name", appName)
        body.put("start_time", sdf.format(startTime))
        body.put("end_time", sdf.format(endTime))
        body.put("duration_seconds", durationSeconds)
        conn.outputStream.write(body.toString().toByteArray())
        conn.inputStream.bufferedReader().readText()
    }

    fun updateConsent(studentId: String, token: String, consented: Boolean) {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        val url = URL("$SUPABASE_URL/rest/v1/consent_records?student_id=eq.$studentId")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "PATCH"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("apikey", ANON_KEY)
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.doOutput = true
        val body = JSONObject()
        body.put("consented", consented)
        if (!consented) body.put("revoked_at", sdf.format(Date()))
        else body.put("consented_at", sdf.format(Date()))
        conn.outputStream.write(body.toString().toByteArray())
        conn.inputStream.bufferedReader().readText()
    }
}
