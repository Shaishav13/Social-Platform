# 🔌 Social Platform API Documentation

Complete API reference for the Social Platform.

## Base URL
```
http://localhost:3003/api/v1
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format
All API responses follow this format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

## Error Responses
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
```

---

## 🔐 Authentication Endpoints

### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "username": "string (3-50 chars, alphanumeric + underscore)",
  "email": "string (valid email)",
  "password": "string (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)",
  "bio": "string (optional, max 500 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "bio": "string",
      "profilePicture": null,
      "isPrivate": false,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

### Get Current User
```http
GET /auth/me
```
*Requires authentication*

### Logout
```http
POST /auth/logout
```

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

### Delete Account
```http
DELETE /auth/account
```
*Requires authentication*

**Request Body:**
```json
{
  "password": "string"
}
```

---

## 📝 Content Endpoints

### Get Feed
```http
GET /content/feed?page=1&limit=10
```
*Requires authentication*

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)

### Create Post
```http
POST /content/posts
```
*Requires authentication*

**Request Body (multipart/form-data):**
```
content: string (required)
files: File[] (optional, images/videos)
isPublic: boolean (default: true)
```

### Get Post
```http
GET /content/posts/:id
```

### Update Post
```http
PUT /content/posts/:id
```
*Requires authentication (post owner only)*

**Request Body:**
```json
{
  "content": "string"
}
```

### Delete Post
```http
DELETE /content/posts/:id
```
*Requires authentication (post owner only)*

### Upload Media
```http
POST /content/upload
```
*Requires authentication*

**Request Body (multipart/form-data):**
```
files: File[] (images/videos)
```

### Get Trending Posts
```http
GET /content/trending?limit=10
```

### Search Posts
```http
GET /content/search/posts?q=query&page=1&limit=10
```

---

## 🤝 Social Endpoints

### Like/Unlike Post
```http
POST /social/posts/:id/like
```
*Requires authentication*

### Get Post Comments
```http
GET /social/posts/:id/comments?page=1&limit=20
```

### Add Comment
```http
POST /social/posts/:id/comments
```
*Requires authentication*

**Request Body:**
```json
{
  "content": "string",
  "parentId": "uuid (optional, for replies)"
}
```

### Update Comment
```http
PUT /social/comments/:id
```
*Requires authentication (comment author only)*

### Delete Comment
```http
DELETE /social/comments/:id
```
*Requires authentication (comment author only)*

### Share Post
```http
POST /social/posts/:id/share
```
*Requires authentication*

### Follow/Unfollow User
```http
POST /social/users/:id/follow
```
*Requires authentication*

### Get User Followers
```http
GET /social/users/:id/followers?page=1&limit=20
```

### Get User Following
```http
GET /social/users/:id/following?page=1&limit=20
```

---

## 👤 Profile Endpoints

### Get User Profile
```http
GET /profile/users/:id
```

### Update Profile
```http
PUT /profile/users/:id
```
*Requires authentication (profile owner only)*

**Request Body:**
```json
{
  "bio": "string (optional)",
  "isPrivate": "boolean (optional)"
}
```

### Search Users
```http
GET /profile/search/users?q=query&page=1&limit=10
```

### Get User Posts
```http
GET /profile/users/:id/posts?page=1&limit=10
```

---

## 📚 Blog Endpoints

### Get User Blogs
```http
GET /blog/users/:id?page=1&limit=10
```

### Create Blog Post
```http
POST /blog/posts
```
*Requires authentication*

**Request Body:**
```json
{
  "title": "string",
  "content": "string",
  "excerpt": "string (optional)",
  "tags": ["string"] (optional),
  "isDraft": "boolean (default: false)"
}
```

### Get Blog Post
```http
GET /blog/posts/:id
```

### Update Blog Post
```http
PUT /blog/posts/:id
```
*Requires authentication (author only)*

### Delete Blog Post
```http
DELETE /blog/posts/:id
```
*Requires authentication (author only)*

---

## 🔔 Notification Endpoints

### Get Notifications
```http
GET /notifications?page=1&limit=20
```
*Requires authentication*

### Mark Notification as Read
```http
PUT /notifications/:id/read
```
*Requires authentication*

### Mark All Notifications as Read
```http
PUT /notifications/read-all
```
*Requires authentication*

---

## 📊 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## 🔒 Rate Limits

- **API Endpoints**: 500 requests per 15 minutes
- **Auth Endpoints**: 50 requests per 15 minutes
- **Upload Endpoints**: 20 requests per 15 minutes

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- File uploads support JPEG, PNG, GIF images and MP4, MOV, AVI videos
- Maximum file size: 10MB per file
- Maximum 5 files per post
- Usernames are case-insensitive and unique
- Email addresses are case-insensitive and unique

---

**Developed by Shaishav** 🚀