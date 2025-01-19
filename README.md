# Asset Management & RAG System Admin Dashboard

A Next.js 14 admin dashboard for managing AR/VR activities, assets, and RAG-enabled document interactions.

## Features

- 🔐 Authentication & Authorization with Clerk
- 🏢 Organization-based asset management
- 📁 Asset Library (3D Objects, Images, RAG Documents)
- 🤖 RAG integration for AI interactions
- 🗄️ IBM Cloud Object Storage integration
- 📊 MongoDB for metadata storage
- 🎨 Modern UI with shadcn/ui components
- 🌐 AR/VR activity management

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Auth:** Clerk
- **Database:** MongoDB
- **Storage:** IBM Cloud Object Storage
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS
- **State Management:** React Hooks
- **File Processing:** IBM COS SDK

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- MongoDB instance running
- IBM Cloud Object Storage bucket created
- Clerk account and application set up

## Environment Variables

Create a `.env.local` file in the root directory with:

```bash
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# MongoDB
MONGODB_URI=your_mongodb_uri

# IBM Cloud Object Storage
COS_ENDPOINT=s3.xxx.cloud-object-storage.appdomain.cloud
COS_ACCESS_KEY_ID=your_hmac_access_key_id
COS_SECRET_ACCESS_KEY=your_hmac_secret_access_key
COS_BUCKET_NAME=your_bucket_name
COS_INSTANCE_CRN=your_instance_crn
IBM_CLOUD_REGION=your_instances_region

# API Security
API_SECRET_KEY=your_jwt_signing_key
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/SysEngTeam20/nextjs-admin-platform.git
cd nextjs-admin-platform
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── activity/
│   │   │   └── [activityId]/
│   │   └── library/
│   ├── api/
│   │   ├── activities/
│   │   ├── assets/
│   │   ├── documents/
│   │   └── llm/
│   ├── api/
│   │   └── page.tsx
│   └── layout.tsx
├── components/
│   ├── providers/
│   │   └── toaster-provider.tsx
│   ├── ui/
│   └── navbar.tsx
├── hooks/
│   └── use-toast.ts
├── lib/
│   ├── cos.ts
│   ├── mongodb.ts
│   ├── tokens.ts
│   └── utils.ts
├── types/
│   ├── activity.ts
│   ├── asset.ts
│   └── document.ts
└── middleware.ts
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

## API Routes

### Activities
- `GET /api/activities` - List all activities
- `POST /api/activities` - Create new activity
- `GET /api/activities/[id]` - Get activity details
- `PATCH /api/activities/[id]` - Update activity
- `DELETE /api/activities/[id]` - Delete activity

### Assets
- `GET /api/assets` - List all assets
- `POST /api/assets` - Upload new asset
- `GET /api/assets/[id]` - Get asset details
- `PATCH /api/assets/[id]` - Update asset
- `DELETE /api/assets/[id]` - Delete asset

### RAG Endpoints
- `POST /api/activities/[id]/rag-token` - Generate LLM access token
- `GET /api/llm/documents` - Get documents (LLM access)

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

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## Deployment

### Prerequisites
- Vercel account (recommended)
- MongoDB Atlas instance
- IBM Cloud Object Storage bucket
- Clerk production credentials

### Deployment Steps
1. Push your code to GitHub
2. Import project to Vercel
3. Configure environment variables
4. Deploy!

## Monitoring and Maintenance

### Regular Tasks
- Monitor storage usage
- Check access logs
- Update dependencies
- Backup database

### Performance Monitoring
- API response times
- File upload/download speeds
- Database query performance
- Authentication flow metrics

## Troubleshooting

### Common Issues
1. **URL Expiration**
   - Check token validity
   - Verify URL generation

2. **File Upload Failures**
   - Validate file size
   - Check storage permissions

3. **RAG Integration Issues**
   - Verify token generation
   - Check document access

## License

[MIT License](LICENSE.md)

## Support

For support, please open an issue in the repository or contact the maintainers.

## Acknowledgments

- Next.js team
- Clerk team
- shadcn/ui components
- IBM Cloud team
- MongoDB team

---
