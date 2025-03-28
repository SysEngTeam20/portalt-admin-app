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
- **Database:** SQLite (better-sqlite3)
- **Storage:** IBM Cloud Object Storage
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS
- **State Management:** React Hooks
- **File Processing:** IBM COS SDK
- **Desktop:** Electron

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- IBM Cloud Object Storage bucket created
- Clerk account and application set up
- Git

## Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/admin-app.git
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

4. Update the `.env.local` file with your credentials:
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# IBM Cloud Object Storage
COS_ENDPOINT=your_cos_endpoint
COS_ACCESS_KEY_ID=your_cos_access_key_id
COS_SECRET_ACCESS_KEY=your_cos_secret_access_key
COS_BUCKET_NAME=your_bucket_name
COS_INSTANCE_CRN=your_instance_crn
IBM_CLOUD_REGION=your_region

# API Security
API_SECRET_KEY=your_api_secret_key
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
└── public/               # Static assets
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

## Deployment Strategies

### 1. Desktop Application Distribution

#### Using electron-builder
```bash
# Build the application
npm run build

# Create distributable
npm run dist
```

The packaged application will be available in the `dist` directory for:
- Windows (.exe)
- macOS (.dmg)
- Linux (.AppImage, .deb, .rpm)

#### Configuration
The `electron-builder.yml` file contains build configuration:
```yaml
appId: com.yourcompany.portalt
productName: Portalt
directories:
  output: dist
files:
  - app/**/*
  - package.json
  - .next/**/*
  - public/**/*
  - node_modules/**/*
mac:
  category: public.app-category.productivity
win:
  target: nsis
linux:
  target: AppImage
```

### 2. Web Application Deployment

#### Vercel Deployment
1. Push your code to GitHub
2. Import project to Vercel
3. Configure environment variables
4. Deploy!

#### Custom Server Deployment
1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

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
   - Check SQLite database integrity
   - Verify database permissions
   - Check for database locks

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
