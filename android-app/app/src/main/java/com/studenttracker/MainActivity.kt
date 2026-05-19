package com.studenttracker

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs = getSharedPreferences("tracker_prefs", MODE_PRIVATE)
        val token = prefs.getString("auth_token", null)

        if (token != null) {
            startActivity(Intent(this, DashboardActivity::class.java))
            finish()
            return
        }

        val fullNameInput = findViewById<EditText>(R.id.fullNameInput)
        val emailInput = findViewById<EditText>(R.id.emailInput)
        val passwordInput = findViewById<EditText>(R.id.passwordInput)
        val loginButton = findViewById<Button>(R.id.loginButton)
        val signupButton = findViewById<Button>(R.id.signupButton)

        loginButton.setOnClickListener {
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val result = SupabaseClient.signIn(email, password)
                    val token = result.getString("access_token")
                    val userId = result.getJSONObject("user").getString("id")

                    prefs.edit()
                        .putString("auth_token", token)
                        .putString("student_id", userId)
                        .apply()

                    withContext(Dispatchers.Main) {
                        startActivity(Intent(this@MainActivity, ConsentActivity::class.java))
                        finish()
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "Login failed: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        signupButton.setOnClickListener {
            val fullName = fullNameInput.text.toString().trim()
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString().trim()

            if (fullName.isEmpty() || email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Fill all fields including your name", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val result = SupabaseClient.signUp(email, password, fullName, "student")
                    val token = result.getString("access_token")
                    val userId = result.getJSONObject("user").getString("id")

                    prefs.edit()
                        .putString("auth_token", token)
                        .putString("student_id", userId)
                        .apply()

                    withContext(Dispatchers.Main) {
                        startActivity(Intent(this@MainActivity, ConsentActivity::class.java))
                        finish()
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "Signup failed: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }
}
