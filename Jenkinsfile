pipeline {
  agent any

  environment {
    SSH_HOST = "deploy@app-server.tail272227.ts.net"
    APP_DIR  = "/var/www/boardingapp/staging"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Sync files to VM') {
      steps {
        sshagent(['deploy-ssh']) {
          sh '''
            rsync -az --delete \
              --exclude node_modules \
              --exclude .git \
              ./ ${SSH_HOST}:${APP_DIR}/
          '''
        }
      }
    }

    stage('Inject environment variables') {
      steps {
        withCredentials([
          string(credentialsId: 'db_password', variable: 'DB_PASSWORD'),
          string(credentialsId: 'cookie_secret', variable: 'COOKIE_SECRET')
        ]) {
          sshagent(['deploy-ssh']) {
            sh """
              ssh ${SSH_HOST} '
                cat > ${APP_DIR}/.env.backend << EOF
NODE_ENV=staging
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=board_gis_db
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}
COOKIE_SECRET=${COOKIE_SECRET}
EOF
              '
            """
          }
        }
      }
    }

    stage('Build & Deploy (Docker)') {
      steps {
        sshagent(['deploy-ssh']) {
          sh """
            ssh ${SSH_HOST} '
              cd ${APP_DIR} &&
              docker compose down &&
              docker compose up -d --build
            '
          """
        }
      }
    }
  }

  post {
    success {
      echo "✅ Staging deployment successful"
    }
    failure {
      echo "❌ Deployment failed"
    }
  }
}
