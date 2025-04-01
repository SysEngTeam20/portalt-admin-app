import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/view/(.*)',
  '/api/llm/(.*)',
  '/api/scenes-configuration/(.*)',
  '/api/pairing/(.*)',
  '/api/public/activity-join(.*)',
  '/api/activities/(.*)',
  '/api/activities',
  '/api/scenes/(.*)'
])

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims, redirectToSignIn } = await auth()

    // Check for pairing code in API routes first
    if (req.nextUrl.pathname.startsWith('/api/')) {
      const url = new URL(req.url)
      const pairingCode = url.searchParams.get('pairingCode')
      
      if (pairingCode) {
        try {
          console.log('Found pairing code:', pairingCode)
          const response = await fetch(`${req.nextUrl.origin}/api/pairing/validate?code=${pairingCode}`)
          if (response.ok) {
            const { orgId } = await response.json()
            console.log('Valid orgId from pairing:', orgId)
            // Add orgId as a query parameter
            url.searchParams.set('orgId', orgId)
            console.log('Rewriting URL to:', url.toString())
            return NextResponse.rewrite(url)
          } else {
            console.log('Pairing validation failed:', await response.text())
          }
        } catch (error) {
          console.error('Error validating pairing code:', error)
        }
      }
    }

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