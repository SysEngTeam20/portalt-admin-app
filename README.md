# Portalt - Asset Management & RAG System Admin Dashboard

A Next.js 14 + Electron desktop application for managing AR/VR activities, assets, and RAG-enabled document interactions.

## Features

- 🔐 Authentication & Authorization with Clerk
- 🏢 Organization-based asset management
- 📁 Asset Library (3D Objects, Images, RAG Documents)
- 🤖 RAG integration for AI interactions
- 🗄️ IBM Cloud Object Storage integration
- 📊 SQLite for local data storage
- 🎨 Modern UI with shadcn/ui components
- 🌐 AR/VR activity management
- 💻 Cross-platform desktop application

## Tech Stack

- **Framework:** Next.js 14 (App Router) + Electron
- **Language:** TypeScript
- **Auth:** Clerk
- **Database:** 
  - Development: SQLite (better-sqlite3)
  - Production: MongoDB
- **Storage:** IBM Cloud Object Storage
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS
- **State Management:** React Hooks
- **File Processing:** IBM COS SDK
- **Desktop:** Electron
- **Containerization:** Docker
- **Orchestration:** Kubernetes
- **Cloud:** IBM Cloud

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- IBM Cloud Object Storage bucket created
- Clerk account and application set up
- Git
- Docker (for containerization)
- kubectl (for Kubernetes deployment)
- IBM Cloud CLI (for IBM Cloud deployment)

## Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/SysEngTeam20/portalt-admin-app.git
cd admin-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory (see `.env.example` for reference):
```bash
cp .env.example .env.local
```

4. Set up Clerk Authentication:
   - Create an account at [Clerk](https://clerk.dev)
   - Create a new application
   - Get your API keys from the Clerk dashboard
   - Configure your application's URLs in the Clerk dashboard

5. Set up IBM Cloud Object Storage:
   - Create an IBM Cloud account if you don't have one
   - Create a Cloud Object Storage instance
   - Create a bucket for your assets
   - Generate service credentials with HMAC enabled
   - Get your instance CRN and region

6. Set up Database:
   - For development: SQLite will be automatically created in the `data` directory
   - For production: Set up a MongoDB instance (Atlas recommended)
     - Create a MongoDB Atlas account
     - Create a new cluster
     - Get your connection string
     - Create a database user
     - Whitelist your IP addresses

7. Update the `.env.local` file with your credentials:
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Clerk URL Configuration
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Database Configuration
# For development (SQLite)
SQLITE_DB_PATH=./data/portalt.db

# For production (MongoDB)
MONGODB_URI=your_mongodb_connection_string

# IBM Cloud Object Storage
COS_ENDPOINT=your_cos_endpoint
COS_ACCESS_KEY_ID=your_cos_access_key_id
COS_SECRET_ACCESS_KEY=your_cos_secret_access_key
COS_BUCKET_NAME=your_bucket_name
COS_INSTANCE_CRN=your_instance_crn
IBM_CLOUD_REGION=your_region

# API Security
API_SECRET_KEY=your_api_secret_key  # Generate a secure random string
```

8. Generate a secure API secret key:
```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## Development

### Running in Development Mode

1. Start the development server:
```bash
npm run dev
```
This will concurrently run:
- Next.js development server
- Electron application

2. The application will open automatically in Electron mode

### Building for Production

1. Build the application:
```bash
npm run build
```

2. Package the application:
```bash
npm run dist
```

The packaged application will be available in the `dist` directory.

## Containerization

### Building Docker Image

1. Build the Docker image:
```bash
docker build -t portalt-admin:latest .
```

2. Test the container locally:
```bash
docker run -p 3000:3000 --env-file .env.local portalt-admin:latest
```

## Deployment

### Kubernetes Deployment

1. Create a namespace:
```bash
kubectl create namespace portalt
```

2. Create secrets from your environment variables:
```bash
kubectl create secret generic portalt-secrets \
  --namespace portalt \
  --from-literal=clerk-publishable-key=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --from-literal=clerk-secret-key=$CLERK_SECRET_KEY \
  --from-literal=cos-endpoint=$COS_ENDPOINT \
  --from-literal=cos-access-key-id=$COS_ACCESS_KEY_ID \
  --from-literal=cos-secret-access-key=$COS_SECRET_ACCESS_KEY \
  --from-literal=cos-bucket-name=$COS_BUCKET_NAME \
  --from-literal=cos-instance-crn=$COS_INSTANCE_CRN \
  --from-literal=ibm-cloud-region=$IBM_CLOUD_REGION \
  --from-literal=api-secret-key=$API_SECRET_KEY
```

3. Apply Kubernetes manifests:
```bash
kubectl apply -f k8s/
```

### IBM Cloud Deployment

1. Login to IBM Cloud:
```bash
ibmcloud login
```

2. Set your target region and resource group:
```bash
ibmcloud target -r <region> -g <resource-group>
```

3. Create a container registry namespace:
```bash
ibmcloud cr namespace-add portalt
```

4. Tag and push the Docker image:
```bash
docker tag portalt-admin:latest us.icr.io/portalt/portalt-admin:latest
docker push us.icr.io/portalt/portalt-admin:latest
```

5. Create a Kubernetes cluster (if not exists):
```bash
ibmcloud ks cluster create classic --name portalt-cluster --zone <zone>
```

6. Get cluster credentials:
```bash
ibmcloud ks cluster config --cluster portalt-cluster
```

7. Deploy to Kubernetes:
```bash
kubectl apply -f k8s/
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── (app)/             # Protected routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── electron/              # Electron-specific code
│   ├── main.ts           # Main process
│   └── preload.ts        # Preload script
├── components/            # React components
├── lib/                   # Utility functions
├── types/                # TypeScript types
├── public/               # Static assets
├── k8s/                  # Kubernetes manifests
└── Dockerfile           # Container configuration
```

## Core Features

### Authentication Flow
- Root route ('/') serves as login page
- Protected routes redirect to login
- Organization selection after login
- Role-based access control

### Asset Management
- Unified asset library for all file types
- File upload with type detection
- Secure file access with signed URLs
- Rename and delete capabilities
- Search and filtering options

### RAG Integration
- Document association with activities
- Token-based secure access for LLMs
- Short-lived URLs for document access
- Activity-based document organization

### Activity Management
- AR/VR activity creation
- Scene management for VR activities
- RAG enablement per activity
- Document linking and management

## Security Considerations

### Access Control
- Organization-level isolation
- Role-based permissions
- Activity-scoped document access

### File Security
- Short-lived signed URLs
- Token-based access
- Secure file upload handling

### RAG Security
- Activity-specific tokens
- Limited-time document access
- Secure LLM integration

## Error Handling

The application implements comprehensive error handling:
- Input validation
- File type checking
- Network error handling
- Authentication errors
- Storage service errors
- Database errors

## Monitoring and Maintenance

### Regular Tasks
- Monitor storage usage
- Check access logs
- Update dependencies
- Backup database
- Monitor application performance

### Performance Monitoring
- API response times
- File upload/download speeds
- Database query performance
- Authentication flow metrics
- Desktop application performance

## Troubleshooting

### Common Issues

1. **Database Issues**
   - Development:
     - Check SQLite database integrity
     - Verify database permissions
     - Check for database locks
   - Production:
     - Verify MongoDB connection string
     - Check MongoDB Atlas network access
     - Monitor MongoDB Atlas metrics
     - Verify database user permissions

2. **File Upload Failures**
   - Validate file size
   - Check storage permissions
   - Verify network connectivity

3. **RAG Integration Issues**
   - Verify token generation
   - Check document access
   - Validate API endpoints

4. **Electron-specific Issues**
   - Check main process logs
   - Verify preload script
   - Check window management

5. **Container Issues**
   - Check container logs
   - Verify environment variables
   - Check resource limits

6. **Kubernetes Issues**
   - Check pod status
   - Verify service endpoints
   - Check ingress configuration

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## License

[MIT License](LICENSE.md)

## Support

For support, please:
1. Open an issue in the repository
2. Contact the maintainers

## Acknowledgments

- Next.js team
- Electron team
- Clerk team
- IBM Cloud team

---
