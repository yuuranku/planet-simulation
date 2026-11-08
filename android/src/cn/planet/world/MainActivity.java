package cn.planet.world;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.window.OnBackInvokedDispatcher;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private static final int PICK_FILE = 11, SAVE_FILE = 12;
    private WebView webView;
    private LinearLayout content;
    private View landscapeHint;
    private boolean handlingBack;
    private ValueCallback<Uri[]> fileCallback;
    private volatile String saveToken;
    private volatile OutputStream saveStream;
    private WebViewAssetLoader assetLoader;
    private final DownloadBridge downloadBridge = new DownloadBridge();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Match the system bars and display-cutout safe area to the app's dark frame.
        int frameColor = 0xff0c2c2e;
        getWindow().setStatusBarColor(frameColor);
        getWindow().setNavigationBarColor(frameColor);
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR));
        if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(this);
        assetLoader = new WebViewAssetLoader.Builder().addPathHandler("/", path -> {
            if (path.contains("..") || path.contains("\\")) return missing();
            if (path.isEmpty()) path = "index.html";
            WebResourceResponse response = assets.handle(path.equals("native-download.js") ? path : "site/" + path);
            if (response == null || response.getData() == null) return missing();
            try {
                if (path.endsWith(".html")) {
                    InputStream input = response.getData();
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = input.read(buffer)) != -1) bytes.write(buffer, 0, n);
                    input.close();
                    String html = new String(bytes.toByteArray(), StandardCharsets.UTF_8)
                            .replaceFirst("(?i)(<head\\b[^>]*>)", "$1<script src=\"/native-download.js\"></script>");
                    response.setData(new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
                }
                // Explicit JavaScript MIME is required for module scripts and workers.
                response.setMimeType(mime(path));
                return response;
            } catch (IOException e) { return missing(); }
        }).build();
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setBackgroundColor(frameColor);
        webView = new WebView(this);
        if (Build.VERSION.SDK_INT >= 35) {
            content.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                int types = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime();
                Insets insets = windowInsets.getInsets(types);
                view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                // The outer container owns these insets; the WebView gets a usable viewport.
                return new WindowInsets.Builder(windowInsets).setInsets(types, Insets.NONE).build();
            });
        }
        addLandscapeHint();
        content.addView(webView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(content);
        content.requestApplyInsets();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.addJavascriptInterface(downloadBridge, "AndroidDownload");
        webView.setWebViewClient(new LocalClient());
        webView.setWebChromeClient(new ChromeClient());
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        webView.loadUrl(ORIGIN + "/index.html");
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void addLandscapeHint() {
        if (getResources().getConfiguration().orientation != Configuration.ORIENTATION_PORTRAIT
                || getPreferences(MODE_PRIVATE).getBoolean("landscape_hint_seen", false)) return;
        LinearLayout banner = new LinearLayout(this);
        banner.setGravity(Gravity.CENTER_VERTICAL);
        banner.setPadding(dp(16), dp(6), dp(8), dp(6));
        banner.setBackgroundColor(0xffeee7d9);
        TextView message = new TextView(this);
        message.setText("建议横屏使用\n横屏查看地图与工具更方便。");
        message.setTextSize(14);
        message.setTextColor(0xff38362f);
        banner.addView(message, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button dismiss = new Button(this);
        dismiss.setText("知道了");
        dismiss.setContentDescription("关闭横屏使用建议");
        dismiss.setOnClickListener(view -> banner.setVisibility(View.GONE));
        banner.addView(dismiss, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        landscapeHint = banner;
        content.addView(banner, 0);
        getPreferences(MODE_PRIVATE).edit().putBoolean("landscape_hint_seen", true).apply();
    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        if (landscapeHint != null && config.orientation == Configuration.ORIENTATION_LANDSCAPE) landscapeHint.setVisibility(View.GONE);
        if (config.orientation == Configuration.ORIENTATION_PORTRAIT) addLandscapeHint();
        content.requestApplyInsets();
        webView.invalidate();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    private WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(),
                new ByteArrayInputStream(new byte[0]));
    }
    private static String mime(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }
    private final class LocalClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            return !"https".equals(url.getScheme()) || !HOST.equals(url.getHost());
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!"https".equals(url.getScheme()) || !HOST.equals(url.getHost())) return missing();
            WebResourceResponse response = assetLoader.shouldInterceptRequest(url);
            return response == null ? missing() : response;
        }
    }

    private final class ChromeClient extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try { startActivityForResult(params.createIntent(), PICK_FILE); }
            catch (ActivityNotFoundException e) { fileCallback = null; callback.onReceiveValue(null); Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_LONG).show(); }
            return true;
        }
        @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定", (d, w) -> result.confirm()).setOnCancelListener(d -> result.cancel()).show(); return true;
        }
        @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定", (d, w) -> result.confirm()).setNegativeButton("取消", (d, w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show(); return true;
        }
        @Override public boolean onJsPrompt(WebView view, String url, String message, String value, JsPromptResult result) {
            EditText input = new EditText(MainActivity.this); input.setSingleLine(true); input.setText(value);
            new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input).setPositiveButton("确定", (d, w) -> result.confirm(input.getText().toString())).setNegativeButton("取消", (d, w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show(); return true;
        }
    }

    private void callJs(String function, String token) {
        webView.evaluateJavascript("window." + function + "(" + JSONObject.quote(token) + ")", null);
    }
    private final class DownloadBridge {
        @JavascriptInterface public void open(String token, String filename, String type) {
            runOnUiThread(() -> {
                if (saveToken != null) { callJs("__atlasCancelSave", token); Toast.makeText(MainActivity.this, "请先完成当前文件保存", Toast.LENGTH_SHORT).show(); return; }
                saveToken = token;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type).putExtra(Intent.EXTRA_TITLE, filename);
                try { startActivityForResult(intent, SAVE_FILE); }
                catch (ActivityNotFoundException e) { saveToken = null; callJs("__atlasCancelSave", token); Toast.makeText(MainActivity.this, "无法打开保存对话框", Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public synchronized boolean write(String token, String data) {
            if (!token.equals(saveToken) || saveStream == null) return false;
            try { saveStream.write(Base64.decode(data, Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
        }
        @JavascriptInterface public synchronized boolean finish(String token) {
            if (!token.equals(saveToken) || saveStream == null) return false;
            try { saveStream.close(); saveStream = null; saveToken = null; runOnUiThread(() -> Toast.makeText(MainActivity.this, "文件已保存", Toast.LENGTH_SHORT).show()); return true; }
            catch (IOException e) { return false; }
        }
        @JavascriptInterface public synchronized void abort(String token) {
            if (!token.equals(saveToken)) return;
            try { if (saveStream != null) saveStream.close(); } catch (IOException ignored) {}
            saveStream = null; saveToken = null;
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); fileCallback = null;
        } else if (requestCode == SAVE_FILE && saveToken != null) {
            String token = saveToken;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) { saveToken = null; callJs("__atlasCancelSave", token); return; }
            try {
                saveStream = getContentResolver().openOutputStream(data.getData(), "w");
                if (saveStream == null) throw new IOException("无法打开文件");
                callJs("__atlasWriteSave", token);
            } catch (IOException | SecurityException e) { saveToken = null; callJs("__atlasCancelSave", token); Toast.makeText(this, "无法保存文件", Toast.LENGTH_LONG).show(); }
        }
    }
    @Override public void onBackPressed() {
        handleBack();
    }
    private void handleBack() {
        if (handlingBack || isFinishing()) return;
        handlingBack = true;
        webView.evaluateJavascript("typeof window.__androidBack === 'function' && window.__androidBack() === true", handled -> {
            if (isFinishing() || isDestroyed()) return;
            if ("true".equals(handled)) { handlingBack = false; return; }
            if (webView.canGoBack()) { webView.goBack(); handlingBack = false; return; }
            new AlertDialog.Builder(this).setMessage("退出星球推演？正在推演的任务将中断。")
                    .setNegativeButton("继续使用", null).setPositiveButton("退出", (d, w) -> finish())
                    .setOnDismissListener(d -> handlingBack = false).show();
        });
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (saveToken != null) downloadBridge.abort(saveToken);
        content.removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
