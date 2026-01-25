pipeline {
  agent any

  parameters {
    choice(
      name: 'TARGET_ENV',
      choices: ['staging', 'production'],
      description: 'Deployment environment'
    )
  }

  environment {
    APP_DIR = params.TARGET_ENV == 'production'
      ? '/var/www/boardingapp/production'
      : '/var/www/boardingapp/staging'

    SSH_HOST = params.TARGET_ENV == 'production'
      ? 'deploy@100.PROD.IP.HERE'
      : 'deploy@100.124.133.68'

    NODE_ENV = params.TARGET_ENV
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Test SSH Connectivity') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh '''
            ssh -o StrictHostKeyChecking=no ${SSH_HOST} \
            "whoami && hostname && mkdir -p ${APP_DIR}"
          '''
        }
      }
    }

    stage('Sync files to VM') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
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
          string(credentialsId: "db_password_${params.TARGET_ENV}", variable: 'DB_PASSWORD'),
          string(credentialsId: "cookie_secret_${params.TARGET_ENV}", variable: 'COOKIE_SECRET')
        ]) {
          sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
            sh """
              ssh ${SSH_HOST} '
                cat > ${APP_DIR}/.env.backend << EOF
NODE_ENV=${NODE_ENV}
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

    stage('Approve Production') {
      when {
        expression { params.TARGET_ENV == 'production' }
      }
      steps {
        input message: '🚨 Deploy to PRODUCTION?'
      }
    }

    // Docker Compose V2 (docker compose). Deploy host must have the Compose V2 plugin.
    stage('Build & Deploy (Docker)') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
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
      echo "✅ ${params.TARGET_ENV.toUpperCase()} deployment successful"
    }
    failure {
      echo "❌ ${params.TARGET_ENV.toUpperCase()} deployment failed"
    }
  }
}
