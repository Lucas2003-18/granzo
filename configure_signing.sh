#!/bin/bash
# Injeta configuração de assinatura no build.gradle do Android
# Executado no CI após `npx cap sync android`

GRADLE_FILE="android/app/build.gradle"

# Inserir signingConfigs antes de buildTypes
python3 - << 'PYEOF'
import re

with open("android/app/build.gradle", "r") as f:
    content = f.read()

signing_block = """
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "granzo-release.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias System.getenv("KEY_ALIAS") ?: "granzo"
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }
"""

release_signing = '            signingConfig signingConfigs.release\n'

# Inserir signingConfigs antes de buildTypes
if "signingConfigs" not in content:
    content = content.replace("    buildTypes {", signing_block + "    buildTypes {")

# Inserir signingConfig dentro de release buildType
if "signingConfig signingConfigs.release" not in content:
    content = content.replace(
        "        release {",
        "        release {\n" + release_signing,
        1
    )

with open("android/app/build.gradle", "w") as f:
    f.write(content)

print("build.gradle configurado para assinatura release")
PYEOF
