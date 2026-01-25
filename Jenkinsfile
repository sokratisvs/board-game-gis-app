pipeline {
  agent any

  parameters {
    choice(
      name: 'TARGET_ENV',
      choices: ['staging', 'production'],
      description: 'Deployment environment'
    )
  }

  stages {

    stage('Init') {
      steps {
        script {
          if (params.TARGET_ENV == 'production') {
            env.APP_DIR  = '/var/www/boardingapp/production'
            env.SSH_HOST = 'deploy@100.PROD.IP.HERE'
            env.NODE_ENV = 'production'
          } else {
            env.APP_DIR  = '/var/www/boardingapp/staging'
            env.SSH_HOST = 'deploy@100.124.133.68'
            env.NODE_ENV = 'staging'
          }
          env.COMPOSE_FILE = 'containers/postgres/docker-compose.yml'
        }
      }
    }

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

    stage('Build & Deploy (Docker)') {
      steps {
        sshagent(["deploy-ssh-${params.TARGET_ENV}"]) {
          sh """
            ssh ${SSH_HOST} '
              cd ${APP_DIR} &&
              docker compose -f ${COMPOSE_FILE} down &&
              docker compose -f ${COMPOSE_FILE} up -d --build
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
