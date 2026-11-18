import { RepoFileEntry } from '../utils/zipBuilder';

export const ANDROID_FILES_PART_1: RepoFileEntry[] = [
  {
    path: '.gitignore',
    phase: 'Phase 1: Project Setup',
    description: 'Standard Android & Gradle ignore rules for GitHub.',
    content: `*.iml
.gradle
/local.properties
/.idea/
.DS_Store
/build
/app/build
/captures
.externalNativeBuild
.cxx
*.jks
*.keystore
`,
  },
  {
    path: 'gradle/libs.versions.toml',
    phase: 'Phase 1: Project Setup',
    description: 'Pinned stable Gradle version catalog (AGP 9.4.0, Kotlin 2.4.20, Room 2.8.5, Hilt 2.60.1).',
    content: `[versions]
agp = "9.4.0"
kotlin = "2.4.20"
ksp = "2.3.13"

coreKtx = "1.19.1"
activityCompose = "1.13.0"
lifecycle = "2.11.0"

composeBom = "2026.09.00"
navigationCompose = "2.10.2"

hilt = "2.60.1"
androidxHilt = "1.4.0"

room = "2.8.5"
datastore = "1.3.0"
work = "2.12.0"

kotlinxCoroutines = "1.11.0"
kotlinxSerializationJson = "1.10.0"

junit = "4.13.2"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }

androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }

androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }

hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-compiler", version.ref = "hilt" }
androidx-hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version.ref = "androidxHilt" }
androidx-hilt-work = { group = "androidx.hilt", name = "hilt-work", version.ref = "androidxHilt" }
androidx-hilt-compiler = { group = "androidx.hilt", name = "hilt-compiler", version.ref = "androidxHilt" }

androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
androidx-room-testing = { group = "androidx.room", name = "room-testing", version.ref = "room" }

androidx-datastore-preferences = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }
androidx-work-runtime-ktx = { group = "androidx.work", name = "work-runtime-ktx", version.ref = "work" }

kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "kotlinxCoroutines" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "kotlinxCoroutines" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "kotlinxSerializationJson" }

junit = { group = "junit", name = "junit", version.ref = "junit" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
hilt-android = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
room = { id = "androidx.room", version.ref = "room" }
`,
  },
  {
    path: 'gradle/wrapper/gradle-wrapper.properties',
    phase: 'Phase 1: Project Setup',
    description: 'Gradle 9.6.0 wrapper configuration.',
    content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-9.6.0-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
  },
  {
    path: 'gradle.properties',
    phase: 'Phase 1: Project Setup',
    description: 'JVM & AndroidX build properties.',
    content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`,
  },
  {
    path: 'settings.gradle.kts',
    phase: 'Phase 1: Project Setup',
    description: 'Repository & root project module definition.',
    content: `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "FinMate"
include(":app")
`,
  },
  {
    path: 'build.gradle.kts',
    phase: 'Phase 1: Project Setup',
    description: 'Root build script (AGP 9 built-in Kotlin).',
    content: `plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt.android) apply false
    alias(libs.plugins.room) apply false
}
`,
  },
  {
    path: 'app/build.gradle.kts',
    phase: 'Phase 1: Project Setup',
    description: 'App module Gradle build with Room, Hilt, WorkManager, DataStore, Compose & analytics flag.',
    content: `import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.room)
}

android {
    namespace = "com.finmate.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.finmate.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0-pilot"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("boolean", "ENABLE_ANALYTICS_UPLOAD", "false")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    room {
        schemaDirectory("$projectDir/schemas")
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)

    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.compiler)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.work.runtime.ktx)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    phase: 'Phase 1 & 4: Manifest & Receiver',
    description: 'Permissions (READ_SMS, RECEIVE_SMS, POST_NOTIFICATIONS), FileProvider for CSV export, and SmsBroadcastReceiver.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature
        android:name="android.hardware.telephony"
        android:required="false" />

    <uses-permission android:name="android.permission.READ_SMS" />
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".FinMateApplication"
        android:allowBackup="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@android:drawable/sym_def_app_icon"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.FinMate">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <receiver
            android:name=".data.sms.SmsBroadcastReceiver"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
`,
  },
  {
    path: 'app/src/main/res/xml/file_paths.xml',
    phase: 'Phase 8: Analytics Export',
    description: 'FileProvider paths for local analytics CSV export.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <cache-path name="analytics_exports" path="exports/" />
</paths>
`,
  },
  {
    path: 'app/src/main/res/values/strings.xml',
    phase: 'Phase 1: Project Setup',
    description: 'App strings.',
    content: `<resources>
    <string name="app_name">FinMate</string>
    <string name="tagline">Never run out of money before month-end.</string>
</resources>
`,
  },
  {
    path: 'app/src/main/res/values/themes.xml',
    phase: 'Phase 1: Project Setup',
    description: 'Material Light NoActionBar host theme.',
    content: `<resources>
    <style name="Theme.FinMate" parent="android:Theme.Material.Light.NoActionBar" />
</resources>
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/FinMateApplication.kt',
    phase: 'Phase 1 & 4: Application & WorkManager',
    description: 'Hilt Application implementing WorkManager Configuration.Provider.',
    content: `package com.finmate.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class FinMateApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/MainActivity.kt',
    phase: 'Phase 1: Activity',
    description: 'Single-activity Compose host with edge-to-edge and app_open analytics logging.',
    content: `package com.finmate.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.finmate.app.data.repository.AnalyticsRepository
import com.finmate.app.data.repository.SettingsRepository
import com.finmate.app.ui.navigation.FinMateNavHost
import com.finmate.app.ui.theme.FinMateTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var settingsRepository: SettingsRepository
    @Inject lateinit var analyticsRepository: AnalyticsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        lifecycleScope.launch {
            settingsRepository.ensureInstallInitialized()
            analyticsRepository.logEvent("app_open")
            val settings = settingsRepository.settingsFlow.first()
            setContent {
                FinMateTheme {
                    FinMateNavHost(onboardingCompleted = settings.onboardingCompleted)
                }
            }
        }
    }
}
`,
  },
];
