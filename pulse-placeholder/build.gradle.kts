plugins {
    java
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://repo.extendedclip.com/content/repositories/placeholderapi/")
}

dependencies {
    compileOnly(project(":"))
    compileOnly("io.papermc.paper:paper-api:26.3.build.5-alpha")
    compileOnly("me.clip:placeholderapi:2.11.6")
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(25)
}

tasks {
    processResources {
        filteringCharset = Charsets.UTF_8.name()
        val props = mapOf("version" to version)
        filesMatching("paper-plugin.yml") {
            expand(props)
        }
    }

    withType<JavaCompile>().configureEach {
        options.encoding = Charsets.UTF_8.name()
    }
}
