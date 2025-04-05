import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes and their allowed roles
const protectedRoutes = {
  '/dashboard': ['ADMIN', 'STAFF', 'FAMILY', 'RESIDENT'],
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/staff': ['ADMIN', 'STAFF'],
  '/dashboard/family': ['ADMIN', 'FAMILY'],
  '/dashboard/resident': ['ADMIN', 'RESIDENT'],
};

// Auth-related routes that should always pass through
const authRoutes = [
  '/login', 
  '/register', 
  '/auth/callback', 
  '/forgot-password', 
  '/reset-password',
  '/direct-login',   
  '/direct-dashboard',
  '/dashboard-direct',
  '/force-dashboard'
];

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  
  const supabase = createMiddlewareClient(
    { req: request, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }
  );

  // Refresh session if expired
  await supabase.auth.getSession();
  
  // Get the pathname
  const path = request.nextUrl.pathname;
  
  // Skip middleware for public assets
  if (
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico') ||
    path.startsWith('/public')
  ) {
    return res;
  }
  
  try {
    // Always pass through auth-related routes without checking auth
    if (authRoutes.some(route => path === route || path.startsWith(`${route}/`))) {
      console.log(`Middleware: Auth route detected (${path}), passing through`);
      return res;
    }
    
    // Check if the current path is a protected route
    const isProtectedRoute = Object.keys(protectedRoutes).some(route => 
      path.startsWith(route)
    );
    
    // Skip if not a protected route
    if (!isProtectedRoute) {
      console.log(`Middleware: Non-protected route detected (${path}), passing through`);
      return res;
    }
    
    // Print out the cookies for debugging
    console.log('Middleware: Cookies received:', request.cookies.toString());
    
    // Enhanced session detection: First try to detect auth via cookies directly
    const hasAuthCookie = 
      request.cookies.has('sb-access-token') || 
      request.cookies.has('sb-refresh-token') || 
      Object.entries(request.cookies.getAll())
        .some(([name]) => name.startsWith('sb-') && name.includes('auth'));
    
    if (hasAuthCookie) {
      console.log('Middleware: Auth detected via cookies, allowing access');
      return res;
    }
    
    // Fallback to Supabase's getSession
    console.log(`Middleware: No auth cookies found, checking session via API`);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Middleware: Error checking session:', sessionError);
      return redirectToLogin(request, path);
    }
    
    // If no session, redirect to login
    if (!session) {
      console.log('Middleware: No session found, redirecting to login');
      return redirectToLogin(request, path);
    }
    
    console.log(`Middleware: User authenticated, user ID: ${session.user.id}`);
    
    // Simple role check
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (profileError) {
        console.error('Middleware: Error fetching user role:', profileError);
        // Continue without role check if there's an error
        return res;
      }
      
      const userRole = profile?.role;
      const routeEntry = Object.entries(protectedRoutes)
        .find(([route]) => path.startsWith(route));
      
      if (routeEntry && userRole) {
        const allowedRoles = routeEntry[1];
        if (!allowedRoles.includes(userRole)) {
          console.log(`Middleware: User role ${userRole} not allowed for ${path}, redirecting to dashboard`);
          return NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin));
        }
      }
    } catch (error) {
      console.error('Middleware: Error during role check:', error);
      // Continue without role check if there's an exception
    }
    
    // Allow access to protected route
    console.log('Middleware: Access granted to protected route');
    return res;
  } catch (error) {
    console.error('Middleware: Unexpected error:', error);
    // For any unexpected errors, allow the request to proceed
    // This prevents middleware from completely blocking access
    return res;
  }
}

// Helper function to redirect to login
function redirectToLogin(request: NextRequest, path: string) {
  const baseUrl = request.nextUrl.origin;
  const url = new URL('/login', baseUrl);
  
  // Only add redirectedFrom parameter if this is not the root path
  if (path !== '/') {
    url.searchParams.set('redirectedFrom', path);
  }
  
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Match all request paths except for static assets
    '/((?!_next/static|_next/image|images|favicon.ico).*)',
  ],
}; 