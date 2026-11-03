plugins {
    id("java-library")
    id("xyz.jpenilla.run-paper") version "3.1.0"
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:26.3.build.5-alpha")
    testImplementation("junit:junit:4.13.2")

    // Явные runtime-зависимости: джар собирается «жирным» (fat), чтобы плагин
    // работал без внешних библиотек на classpath сервера.
    implementation("com.google.code.gson:gson:2.11.0") {
        exclude(group = "org.slf4j", module = "slf4j-api")
    }
    implementation("com.zaxxer:HikariCP:6.2.1") {
        exclude(group = "org.slf4j", module = "slf4j-api")
    }
    implementation("com.maxmind.db:maxmind-db:3.1.1")
    // JDBC-драйверы входят в fat JAR: на игровых хостингах их обычно нет в classpath.
    runtimeOnly("org.xerial:sqlite-jdbc:3.53.4.0")
    runtimeOnly("com.mysql:mysql-connector-j:9.6.0") {
        // Pulse использует обычный JDBC; protobuf нужен только MySQL X DevAPI.
        exclude(group = "com.google.protobuf", module = "protobuf-java")
    }
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(25)
}

tasks {
    runServer {
        // Configure the Minecraft version for our task.
        // This is the only required configuration besides applying the plugin.
        // Your plugin's jar (or shadowJar if present) will be used automatically.
        minecraftVersion("26.3")
        jvmArgs("-Xms2G", "-Xmx2G")
    }

    processResources {
        filteringCharset = Charsets.UTF_8.name()
        val props = mapOf("version" to version)
        filesMatching("paper-plugin.yml") {
            expand(props)
        }
    }

    // Собирает «жирный» jar: вкладывает gson / HikariCP / maxmind-db внутрь плагина.
    jar {
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
        from(configurations.runtimeClasspath.map { c ->
            c.map {
                if (it.isDirectory) it else zipTree(it)
            }
        }) {
            exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA")
            exclude("module-info.class")
            exclude("META-INF/versions/**/module-info.class")
        }
    }

    withType<JavaCompile>().configureEach {
        options.encoding = Charsets.UTF_8.name()
    }
}
