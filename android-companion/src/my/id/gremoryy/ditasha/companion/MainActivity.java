package my.id.gremoryy.ditasha.companion;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.ClipData;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.net.URI;
public final class MainActivity extends Activity {
 private WebView web;private TextView error;private ProgressBar progress;private String origin;
 private ValueCallback<Uri[]> files;private String[] pendingDownload;
 private int dp(int value){return (int)(getResources().getDisplayMetrics().density*value+.5f);}
 private boolean own(String url){try{URI a=new URI(origin),b=new URI(url);return "https".equalsIgnoreCase(b.getScheme())&&a.getHost().equalsIgnoreCase(b.getHost())&&(b.getPort()==-1||b.getPort()==443)&&b.getRawUserInfo()==null;}catch(Exception e){return false;}}
 private String address(String url)throws Exception{URI u=new URI(url.trim());if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null||u.getRawUserInfo()!=null||u.getRawQuery()!=null||u.getRawFragment()!=null||(u.getPort()!=-1&&u.getPort()!=443)||!(u.getPath().isEmpty()||u.getPath().equals("/")))throw new Exception();return "https://"+u.getHost().toLowerCase(java.util.Locale.ROOT);}
 @Override public void onCreate(Bundle saved){super.onCreate(saved);origin=getPreferences(MODE_PRIVATE).getString("server","https://workspace.gremoryy.my.id");
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(Color.rgb(16,32,27));layout.setFitsSystemWindows(true);
  if(Build.VERSION.SDK_INT>=35){layout.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets padding=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(padding.left,padding.top,padding.right,padding.bottom);return insets;});}
  LinearLayout bar=new LinearLayout(this);bar.setPadding(dp(12),dp(4),dp(12),dp(4));TextView title=new TextView(this);title.setText("DITASHA  /  COMPANION");title.setTextColor(Color.rgb(110,224,185));title.setTextSize(13);title.setGravity(android.view.Gravity.CENTER_VERTICAL);bar.addView(title,new LinearLayout.LayoutParams(0,dp(46),1));Button refresh=new Button(this);refresh.setText("↻");refresh.setContentDescription("Segarkan");refresh.setOnClickListener(v->web.reload());bar.addView(refresh,new LinearLayout.LayoutParams(dp(50),dp(46)));Button settings=new Button(this);settings.setText("Server");settings.setOnClickListener(v->settings());bar.addView(settings,new LinearLayout.LayoutParams(dp(85),dp(46)));layout.addView(bar);
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);layout.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
  error=new TextView(this);error.setTextColor(Color.rgb(255,183,165));error.setPadding(dp(16),dp(10),dp(16),dp(10));error.setVisibility(View.GONE);layout.addView(error);
  web=new WebView(this);web.setBackgroundColor(Color.rgb(16,32,27));layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setCacheMode(WebSettings.LOAD_NO_CACHE);s.setSupportMultipleWindows(false);WebView.setWebContentsDebuggingEnabled(false);
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String url=request.getUrl().toString();if(own(url))return false;if("https".equals(request.getUrl().getScheme())||"http".equals(request.getUrl().getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,request.getUrl()));}catch(Exception ignored){}}return true;}
   @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError ssl){handler.cancel();problem("Sertifikat HTTPS belum valid. Periksa DNS dan sertifikat server.");}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError issue){if(request.isForMainFrame())problem("Server belum dapat dihubungi. Pastikan server dan DNS sudah dipasang, lalu tekan segarkan.");}
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){if(!own(url)){view.stopLoading();problem("Alamat di luar server workspace diblokir.");return;}error.setVisibility(View.GONE);progress.setVisibility(View.VISIBLE);}
   @Override public void onPageFinished(WebView view,String url){progress.setVisibility(View.GONE);CookieManager.getInstance().flush();}
  });
  web.setWebChromeClient(new WebChromeClient(){@Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);}
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(files!=null)files.onReceiveValue(null);files=callback;Intent pick=new Intent(Intent.ACTION_GET_CONTENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("*/*");pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);try{startActivityForResult(Intent.createChooser(pick,"Pilih file teks / kode"),41);}catch(Exception e){files.onReceiveValue(null);files=null;Toast.makeText(MainActivity.this,"Pemilih file tidak tersedia",Toast.LENGTH_LONG).show();}return true;}
  });web.setDownloadListener((url,agent,disposition,mime,size)->download(url,disposition,mime));web.loadUrl(origin+"/");
 }
 private void problem(String message){error.setText(message);error.setVisibility(View.VISIBLE);progress.setVisibility(View.GONE);}
 private void settings(){EditText input=new EditText(this);input.setSingleLine(true);input.setText(origin);input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);new AlertDialog.Builder(this).setTitle("Alamat server HTTPS").setMessage("Contoh: https://workspace.gremoryy.my.id\nMengganti server akan mengeluarkan akun pada aplikasi ini.").setView(input).setNegativeButton("Batal",null).setPositiveButton("Hubungkan",(d,w)->{try{String next=address(input.getText().toString());if(!next.equals(origin)){origin=next;getPreferences(MODE_PRIVATE).edit().putString("server",origin).apply();CookieManager.getInstance().removeAllCookies(null);CookieManager.getInstance().flush();web.clearHistory();}web.loadUrl(origin+"/");}catch(Exception e){Toast.makeText(this,"Gunakan origin HTTPS tanpa path, query, atau password",Toast.LENGTH_LONG).show();}}).show();}
 private void download(String url,String disposition,String mime){if(!own(url)){problem("Download di luar server diblokir.");return;}if(Build.VERSION.SDK_INT<29&&checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED){pendingDownload=new String[]{url,disposition,mime};requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},42);return;}try{String filename=URLUtil.guessFileName(url,disposition,mime).replaceAll("[^a-zA-Z0-9._-]","_");if(filename.length()>120)filename=filename.substring(0,120);DownloadManager.Request task=new DownloadManager.Request(Uri.parse(url));String cookie=CookieManager.getInstance().getCookie(url);if(cookie!=null)task.addRequestHeader("Cookie",cookie);task.setMimeType(mime);task.setTitle(filename);task.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);task.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,filename);((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(task);Toast.makeText(this,"Download dimulai",Toast.LENGTH_SHORT).show();}catch(Exception e){problem("Download belum berhasil. Periksa penyimpanan dan login.");}}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==41&&files!=null){Uri[] chosen=null;if(result==RESULT_OK&&data!=null){ClipData clip=data.getClipData();if(clip!=null){chosen=new Uri[Math.min(clip.getItemCount(),5)];for(int i=0;i<chosen.length;i++)chosen[i]=clip.getItemAt(i).getUri();}else if(data.getData()!=null)chosen=new Uri[]{data.getData()};}files.onReceiveValue(chosen);files=null;}}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==42&&pendingDownload!=null){String[] pending=pendingDownload;pendingDownload=null;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)download(pending[0],pending[1],pending[2]);else problem("Izin Downloads diperlukan pada Android 8/9.");}}
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onPause(){super.onPause();CookieManager.getInstance().flush();}
 @Override protected void onDestroy(){if(files!=null)files.onReceiveValue(null);web.destroy();super.onDestroy();}
}
