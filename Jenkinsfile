// Pipeline de Jenkins: corre los tests de Playwright con una etapa por producto y publica
// los reportes. Pensado para un Jenkins en Windows iniciado en la sesión del usuario
// (npm run jenkins), así la etapa de VMS puede abrir las aplicaciones de escritorio.
// Usuarios y contraseñas se cargan en las credenciales de Jenkins (ver README).

// Corre un proyecto de Playwright con su reporte HTML en playwright-report/<proyecto>.
// Si falla, la etapa queda en rojo pero el pipeline sigue con los demás productos.
def playwright(String proyecto, String credencial, String usuario, String password) {
  catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
    withCredentials([usernamePassword(credentialsId: credencial, usernameVariable: usuario, passwordVariable: password)]) {
      withEnv([
        "PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report/${proyecto}",
        "PLAYWRIGHT_JUNIT_OUTPUT_FILE=playwright-report/junit/${proyecto}.xml",
      ]) {
        bat "npx playwright test --project=${proyecto} --reporter=list,html,junit"
      }
    }
  }
}

pipeline {
  agent any

  parameters {
    booleanParam(name: 'ANPR', defaultValue: true, description: 'Tests de ANPR')
    booleanParam(name: 'BIBLIOTECA_DIGITAL', defaultValue: true, description: 'Tests de Biblioteca Digital')
    booleanParam(name: 'AS', defaultValue: false, description: 'Tests de AS: instala y desinstala en la VM por SSH (tarda varios minutos)')
    booleanParam(name: 'VMS', defaultValue: true, description: 'Tests de VMS: abre las aplicaciones de escritorio (no usar el mouse ni el teclado)')
  }

  options {
    disableConcurrentBuilds()
  }

  environment {
    CI = 'true'
    CYPRESS_INSTALL_BINARY = '0' // el pipeline no corre Cypress
    PLAYWRIGHT_HTML_OPEN = 'never'
    BASE_URL = 'https://nginx-central-anpr.testing.docker.dev-dnd.com/www/'
    BD_BASE_URL = 'http://vms-extractions-web.testing.deploy.danaide.com.ar/'
    AS_HOST = '10.150.2.165'
    AS_DIR = '/home/testing/server2.4'
    VMS_DIR = 'C:\\Program Files (x86)\\Danaide\\UltraIP Client'
    VMS_SISTEMA = 'system 145'
  }

  stages {
    stage('Instalar dependencias') {
      steps {
        dir('playwright-report') { deleteDir() }
        bat 'npm ci'
      }
    }
    stage('ANPR') {
      when { expression { params.ANPR } }
      steps { playwright('anpr', 'anpr', 'APP_USER', 'APP_PASSWORD') }
    }
    stage('Biblioteca Digital') {
      when { expression { params.BIBLIOTECA_DIGITAL } }
      steps { playwright('biblioteca-digital', 'biblioteca-digital', 'BD_USER', 'BD_PASSWORD') }
    }
    stage('AS') {
      when { expression { params.AS } }
      steps { playwright('as', 'as', 'AS_USER', 'AS_PASSWORD') }
    }
    stage('VMS') {
      when { expression { params.VMS } }
      steps { playwright('vms', 'vms', 'VMS_USER', 'VMS_PASSWORD') }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'playwright-report/junit/*.xml'
      script {
        def reportes = ['anpr': 'ANPR', 'biblioteca-digital': 'Biblioteca Digital', 'as': 'AS', 'vms': 'VMS']
        reportes.each { proyecto, nombre ->
          if (fileExists("playwright-report/${proyecto}/index.html")) {
            publishHTML(target: [
              reportName: "Reporte ${nombre}",
              reportDir: "playwright-report/${proyecto}",
              reportFiles: 'index.html',
              keepAll: true,
              alwaysLinkToLastBuild: true,
              allowMissing: true,
            ])
          }
        }
      }
    }
  }
}
