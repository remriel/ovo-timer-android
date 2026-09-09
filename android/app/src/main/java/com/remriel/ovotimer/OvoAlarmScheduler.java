package com.remriel.ovotimer;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;

final class OvoAlarmScheduler {
    static final int ALARM_ID = 41001;
    static final String CHANNEL_ID = "ovo-critical-alarm-v3";
    static final String ACTION_FIRE = "com.remriel.ovotimer.action.FIRE_ALARM";
    static final String ACTION_STOP = "com.remriel.ovotimer.action.STOP_ALARM";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";

    private OvoAlarmScheduler() {}

    static boolean schedule(Context context, long triggerAt, String title, String body) {
        AlarmManager alarmManager = context.getSystemService(AlarmManager.class);
        if (alarmManager == null) {
            return false;
        }

        PendingIntent alarmIntent = firePendingIntent(context, title, body);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, alarmIntent);
            return true;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, alarmIntent);
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, alarmIntent);
        }
        return false;
    }

    static void cancel(Context context) {
        AlarmManager alarmManager = context.getSystemService(AlarmManager.class);
        if (alarmManager != null) {
            alarmManager.cancel(firePendingIntent(context, "", ""));
        }
        stopAlarm(context);
    }

    static boolean canScheduleExactAlarms(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }

        AlarmManager alarmManager = context.getSystemService(AlarmManager.class);
        return alarmManager != null && alarmManager.canScheduleExactAlarms();
    }

    static boolean canUseFullScreenIntent(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return true;
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        return notificationManager != null && notificationManager.canUseFullScreenIntent();
    }

    static boolean canBypassDoNotDisturb(Context context) {
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        return notificationManager != null && notificationManager.isNotificationPolicyAccessGranted();
    }

    static boolean canPostNotifications(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    static String openNextPrioritySetting(Activity activity) {
        Context context = activity.getApplicationContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !canScheduleExactAlarms(context)) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            activity.startActivity(intent);
            return "exact-alarm";
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && !canUseFullScreenIntent(context)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            activity.startActivity(intent);
            return "full-screen";
        }

        if (!canBypassDoNotDisturb(context)) {
            activity.startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
            return "do-not-disturb";
        }

        return "ready";
    }

    static void startAlarm(Context context, String title, String body) {
        Intent intent = new Intent(context, OvoAlarmService.class)
            .setAction(ACTION_FIRE)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    static void stopAlarm(Context context) {
        context.stopService(new Intent(context, OvoAlarmService.class));
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager != null) {
            notificationManager.cancel(ALARM_ID);
        }
    }

    static PendingIntent firePendingIntent(Context context, String title, String body) {
        Intent intent = new Intent(context, OvoAlarmReceiver.class)
            .setAction(ACTION_FIRE)
            .setData(Uri.parse("ovo://alarm/" + ALARM_ID))
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body);
        return PendingIntent.getBroadcast(
            context,
            ALARM_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static PendingIntent stopPendingIntent(Context context) {
        Intent intent = new Intent(context, OvoAlarmStopReceiver.class)
            .setAction(ACTION_STOP)
            .setData(Uri.parse("ovo://alarm/" + ALARM_ID));
        return PendingIntent.getBroadcast(
            context,
            ALARM_ID + 1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
