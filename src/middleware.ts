import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/view/(.*)'])

export default clerkMiddleware(async (auth, req) => {
const { userId, redirectToSignIn } = await auth()

    if (!userId && !isPublicRoute(req)) {
        // Add custom logic to run before redirecting

        return redirectToSignIn()
    }

    if (userId && req.nextUrl.pathname === "/") {
        return Response.redirect(new URL("/organization-select", req.url));
    }
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};