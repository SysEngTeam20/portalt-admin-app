import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/view/(.*)',
  '/api/llm/(.*)',
  '/api/scenes-configuration/(.*)',
  '/api/activities/(.*)',
  '/api/assets/(.*)'

])

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims, redirectToSignIn } = await auth()

    // User is on a public route
    if(isPublicRoute(req)){
        return NextResponse.next()
    }

    // User isn't signed in
    if (!userId) {
        return redirectToSignIn()
    }

    // User is signed in and didn't select an organization yet during his session
    if (userId && !sessionClaims.org_id && req.nextUrl.pathname !== "/organization-select") {
        return Response.redirect(new URL("/organization-select", req.url));
    }

    // User is signed in and has an organization selected
    if(userId && sessionClaims.org_id){
        return NextResponse.next()
    }
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};