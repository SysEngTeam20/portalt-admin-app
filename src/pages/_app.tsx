import { ClerkProvider } from "@clerk/nextjs";
import { AppProps } from "next/app";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { MainLayout } from "@/components/MainLayout";
import Head from "next/head";
import './globals.css';

// Auth pages that should only use the base layout
const authPages = [
  '/sign-in',
  '/sign-up',
  '/sign-in/[[...index]]',
  '/sign-up/[[...index]]',
  '/org-selection',
  '/org-selection/[[...index]]'
];

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  // Check if the current page is an auth page
  const isAuthPage = authPages.includes(router.pathname);

  return (
    <ClerkProvider {...pageProps}>
      <Head>
        <title>Portalt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <Layout>
        {isAuthPage ? (
          // Auth pages only get the base layout
          <Component {...pageProps} />
        ) : (
          // Other pages get both layouts
          <MainLayout>
            <Component {...pageProps} />
          </MainLayout>
        )}
      </Layout>
    </ClerkProvider>
  );
}