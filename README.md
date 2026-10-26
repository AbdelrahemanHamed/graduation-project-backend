# ☁️ Google Drive Clone — Cloud Storage & Collaboration Engine

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens" alt="JWT" />
  <img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=Swagger&logoColor=black" alt="Swagger" />
</p>

A production-grade, Google Drive-style cloud storage and team collaboration backend built for an Academic Graduation Project. Designed with **NestJS**, **Prisma ORM**, and **PostgreSQL**, this engine powers hierarchical file & folder organization, media streaming, granular email-based permissions, expiring public links, and storage deduplication.

---

## 🌟 Key Features

### 📁 1. Recursive Folder Hierarchy & Breadcrumbs
- Self-referencing recursive tree structure supporting infinitely nested folders.
- Real-time breadcrumb trail generation (`/Root / College / Semester 1 / Project`).
- Intelligent **cycle-detection** preventing circular dependencies when moving folders into their own subtrees.
- Custom folder UI color tags and starring.

### 👥 2. Granular Collaboration & Email Sharing (Google Drive Style)
- **Direct User Sharing**: Grant access to any registered user by their email address.
- **Granular Roles**:
  - `VIEWER`: Read-only, preview, stream, and download.
  - `EDITOR`: Upload files, rename, move, and manage items inside the shared folder.
- **Shared With Me View**: Dedicated view querying all resources shared directly with the authenticated user.
- **Collaborator Autocomplete**: Instant endpoint to search registered users by email or name.

### 🔗 3. Public Shareable Links
- Generate shareable public URL tokens for folders or files without requiring login.
- **Password Protection**: Optional bcrypt-hashed passwords for public links.
- **Time-based Expiration**: Set link expiration timestamps (`expiresAt`).
- **Download Limits**: Restrict max download attempts per link with atomic counters.

### ⚡ 4. Storage Deduplication (SHA-256) & Quota Enforcement
- **SHA-256 Hash Matching**: Detects duplicate uploaded files across the system and reuses existing disk storage blobs, dramatically saving storage.
- **Storage Quotas**: Default 5 GB free storage allocated per user, enforced before accepting binary payloads.
- **Storage Analytics**: Real-time breakdown of storage consumption across **Images**, **Videos**, **Documents**, and **Others**.

### 🎥 5. HTTP Range Video & Audio Streaming
- Implements HTTP Range headers (`206 Partial Content`).
- Allows clients to scrub and stream video/audio directly in modern web players without downloading the full media file.

### 🗑️ 6. Trash Bin (Soft Delete) & 1-Click Restore
- Safe two-step deletion: items first move to Trash with soft delete timestamps.
- One-click restore preserves folder associations.
- Permanent deletion automatically reclaims user storage quota and cleans orphaned storage keys.

### 📜 7. Audit Trail & Activity Logs
- Comprehensive activity tracking: `UPLOAD`, `DOWNLOAD`, `RENAME`, `MOVE`, `DELETE`, `RESTORE`, `SHARE`, and `REVOKE_SHARE`.

---

## 🏛️ System Architecture

```mermaid
graph TD
    Client[Web / Mobile Client] -->|Bearer JWT| NestAPI[NestJS REST API]
    
    subgraph Core Modules
        NestAPI --> Auth[Auth & Users Module]
        NestAPI --> Folders[Folders Module]
        NestAPI --> Files[Files & Media Streaming]
        NestAPI --> Sharing[Sharing & Public Links]
        NestAPI --> Search[Unified Search Engine]
        NestAPI --> Activity[Activity Audit Log]
    end

    Files --> StorageEngine[Storage Engine + SHA-256 Deduplication]
    StorageEngine --> DiskStorage[(Physical Disk /uploads)]

    Folders --> PrismaORM[Prisma ORM Client]
    Files --> PrismaORM
    Sharing --> PrismaORM
    Auth --> PrismaORM
    Activity --> PrismaORM

    PrismaORM --> Postgres[(PostgreSQL Database)]
```

---

## 🗄️ Database Schema Summary

The database is managed with **Prisma ORM** targeting **PostgreSQL**:

- **`User`**: Account credentials, JWT identity, avatar, `storageUsed`, and `storageLimit`.
- **`Folder`**: Recursive tree (`parentId`), owner, color, star, and trash state.
- **`File`**: Name, original filename, mimeType, size in bytes, disk `storageKey`, and SHA-256 `checksum`.
- **`SharedAccess`**: Maps `userId` to `fileId` or `folderId` with `VIEWER` or `EDITOR` role.
- **`ShareLink`**: Tokenized public links with optional password hash, expiration, and download limits.
- **`FileVersion`**: Historical file revisions.
- **`ActivityLog`**: Audit trail recording user interactions on resources.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) running locally or via Docker

### 1. Clone the repository
```bash
git clone https://github.com/AbdelrahemanHamed/graduation-project-backend.git
cd graduation-project-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the project root:
```env
PORT=3000
NODE_ENV=development

# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/grad_project_drive?schema=public"

# JWT configuration
JWT_SECRET="super-secret-jwt-graduation-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Local Storage directory
UPLOAD_DIR="uploads"

# Default Storage Quota: 5GB (in bytes)
DEFAULT_STORAGE_LIMIT_BYTES=5368709120
```

### 4. Push database migrations
```bash
npx prisma db push
```

### 5. Start the development server
```bash
npm run start:dev
```

The server will boot up at `http://localhost:3000/api`.

---

## 📚 Interactive Swagger API Documentation

Once the server is running, explore and test every API endpoint directly in your browser:

👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---

## 📡 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new account (allocates 5GB quota) | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `GET` | `/api/auth/profile` | Get current user profile and quota state | Bearer JWT |

### 👥 Users & Search (`/api/users`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/search?q=` | Collaborator autocomplete by email or name | Bearer JWT |
| `GET` | `/api/users/storage-stats` | Storage analytics and breakdown by file type | Bearer JWT |

### 📁 Folders (`/api/folders`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/folders` | Create folder (root or nested) | Bearer JWT |
| `GET` | `/api/folders?folderId=` | List folder contents (folders & files) | Bearer JWT |
| `GET` | `/api/folders/breadcrumbs/:id` | Get breadcrumb navigation trail | Bearer JWT |
| `PATCH` | `/api/folders/:id/move` | Move folder with cycle prevention | Bearer JWT |
| `PATCH` | `/api/folders/:id` | Rename, change color, or star folder | Bearer JWT |
| `DELETE`| `/api/folders/:id/trash` | Soft-delete folder to Trash | Bearer JWT |
| `PATCH` | `/api/folders/:id/restore` | Restore folder from Trash | Bearer JWT |
| `DELETE`| `/api/folders/:id/permanent` | Permanently delete folder | Bearer JWT |
| `GET` | `/api/folders/starred` | List all starred folders | Bearer JWT |
| `GET` | `/api/folders/trash` | List all trashed folders | Bearer JWT |

### 📄 Files (`/api/files`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/files/upload` | Upload file (`file`, optional `folderId`) | Bearer JWT |
| `GET` | `/api/files/:id` | Get file metadata | Bearer JWT |
| `GET` | `/api/files/:id/download` | Download file with attachment headers | Bearer JWT |
| `GET` | `/api/files/:id/stream` | Stream video/audio with HTTP Range 206 | Bearer JWT |
| `PATCH` | `/api/files/:id/move` | Move file to another folder or root | Bearer JWT |
| `PATCH` | `/api/files/:id` | Rename or star file | Bearer JWT |
| `DELETE`| `/api/files/:id/trash` | Move file to Trash | Bearer JWT |
| `PATCH` | `/api/files/:id/restore` | Restore file from Trash | Bearer JWT |
| `DELETE`| `/api/files/:id/permanent` | Permanent delete and reclaim quota | Bearer JWT |
| `GET` | `/api/files/starred` | List all starred files | Bearer JWT |
| `GET` | `/api/files/trash` | List all trashed files | Bearer JWT |

### 🔗 Sharing & Collaboration (`/api/sharing`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/sharing/email` | Share file/folder with user by email | Bearer JWT |
| `DELETE`| `/api/sharing/access/:id` | Revoke collaborator access | Bearer JWT |
| `GET` | `/api/sharing/collaborators` | List users who have access | Bearer JWT |
| `GET` | `/api/sharing/shared-with-me` | Get files/folders shared with user | Bearer JWT |
| `POST` | `/api/sharing/link` | Create public share link (password, expiry) | Bearer JWT |
| `POST` | `/api/sharing/public/:token` | Resolve public share link | Public |
| `POST` | `/api/sharing/public/:token/download` | Download file via public link | Public |

### 🔍 Search & Audit (`/api/search` & `/api/activity`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/search?q=&type=&isStarred=` | Unified search across files & folders | Bearer JWT |
| `GET` | `/api/activity/recent?limit=` | Recent audit log of actions | Bearer JWT |

---

## 📂 Project Structure

```
graduation-project-backend/
├── prisma/
│   └── schema.prisma         # Prisma Schema (Models & Relations)
├── src/
│   ├── app.module.ts         # Root Application Module
│   ├── main.ts               # App entrypoint (Swagger, CORS, BigInt handler)
│   ├── common/
│   │   ├── decorators/       # @CurrentUser() param decorator
│   │   ├── filters/          # AllExceptionsFilter
│   │   ├── guards/           # JwtAuthGuard
│   │   └── interceptors/     # TransformInterceptor
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts # Prisma Client lifecycle manager
│   └── modules/
│       ├── activity/         # Audit trail service & controller
│       ├── auth/             # JWT Auth, Bcrypt, Login & Register
│       ├── files/            # File upload, streaming & lifecycle
│       ├── folders/          # Nested folder trees & breadcrumbs
│       ├── search/           # Multi-criteria search
│       ├── sharing/          # Email sharing & public link tokens
│       ├── storage/          # Local disk storage & SHA-256 deduplication
│       └── users/            # User profile, search & quota analytics
├── .env.example
├── package.json
└── README.md
```

---

## 👨‍💻 Author & Credits

- **Project**: Graduation Project — Cloud Drive Storage Backend
- **Repository**: [graduation-project-backend](https://github.com/AbdelrahemanHamed/graduation-project-backend)
- **Author**: Abdelraheman Hamed
