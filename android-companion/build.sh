#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sdk_root=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}
[[ -n "$sdk_root" ]] || { echo 'Set ANDROID_SDK_ROOT or ANDROID_HOME.'; exit 1; }
tools="$sdk_root/build-tools/35.0.0"
platform="$sdk_root/platforms/android-35/android.jar"
output_dir=${DITASHA_ANDROID_OUTPUT:-build}
mkdir -p "$output_dir/generated" "$output_dir/classes" "$output_dir/dex"
"$tools/aapt2" compile --dir res -o "$output_dir/res.zip"
"$tools/aapt2" link -o "$output_dir/unsigned.apk" --manifest AndroidManifest.xml -I "$platform" --java "$output_dir/generated" --min-sdk-version 26 --target-sdk-version 35 --version-code 31500 --version-name 3.15.0 "$output_dir/res.zip"
find src "$output_dir/generated" -name '*.java' > "$output_dir/sources.txt"
javac -encoding UTF-8 --release 8 -classpath "$platform" -d "$output_dir/classes" @"$output_dir/sources.txt"
jar cf "$output_dir/classes.jar" -C "$output_dir/classes" .
"$tools/d8" --lib "$platform" --min-api 26 --output "$output_dir/dex" "$output_dir/classes.jar"
python3 - "$output_dir" <<'PY'
import sys,pathlib,zipfile
p=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(p/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as archive:
 for dex in sorted((p/'dex').glob('*.dex')):archive.write(dex,dex.name)
PY
"$tools/zipalign" -f -p 4 "$output_dir/unsigned.apk" "$output_dir/aligned.apk"
keystore=${DITASHA_ANDROID_KEYSTORE:-$output_dir/preview.keystore}
mkdir -p "$(dirname "$keystore")"
if [[ ! -f "$keystore" ]]; then
 keytool -genkeypair -keystore "$keystore" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=DITASHA Personal Preview,O=DITASHA,C=ID' -noprompt
fi
"$tools/apksigner" sign --ks "$keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$output_dir/DITASHA-Companion.apk" "$output_dir/aligned.apk"
"$tools/apksigner" verify --verbose "$output_dir/DITASHA-Companion.apk"
"$tools/aapt2" dump badging "$output_dir/DITASHA-Companion.apk" > "$output_dir/apk-info.txt"
head -12 "$output_dir/apk-info.txt"
sha256sum "$output_dir/DITASHA-Companion.apk" > "$output_dir/DITASHA-Companion.apk.sha256"
