import React, { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * UserInitializer component that automatically creates or updates
 * user records in Convex when users sign in through Clerk OAuth.
 *
 * Also detects GitHub OAuth connections and links them to Convex,
 * triggering an initial token fetch for seamless sync capability.
 *
 * This solves the "User not found" error by ensuring the user
 * exists in the database before any queries are made.
 */
const UserInitializer: React.FC = () => {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsertUserFromClerk);
  const linkGithubAccount = useMutation(api.github.linkGithubAccount);
  const refreshGithubToken = useAction(api.github.refreshGithubToken);

  // Track if we've already processed GitHub account to avoid duplicate calls
  const processedGithubAccountRef = useRef<string | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      console.log('UserInitializer effect triggered:', {
        isLoaded,
        hasUser: !!user,
        userId: user?.id,
      });

      if (!isLoaded) {
        console.log('Auth not loaded yet, skipping user initialization');
        return;
      }

      if (!user) {
        console.log('No user found, skipping user initialization');
        processedGithubAccountRef.current = null; // Reset on logout
        return;
      }

      try {
        // Check for GitHub external account in Clerk
        // The provider string varies by Clerk version - check for both variants
        const githubAccount = user.externalAccounts?.find(
          (account) => account.provider === 'github' || (account.provider as string) === 'oauth_github'
        );

        console.log('Attempting to create/update user in Convex...');

        // Prepare user data with optional GitHub account info
        const userData: {
          clerkUserId: string;
          email: string;
          firstName?: string;
          lastName?: string;
          imageUrl?: string;
          githubAccount?: {
            externalAccountId: string;
            username: string;
            email?: string;
          };
        } = {
          clerkUserId: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          imageUrl: user.imageUrl || undefined,
        };

        // Include GitHub account data if available
        if (githubAccount) {
          userData.githubAccount = {
            externalAccountId: githubAccount.id,
            username: githubAccount.username || '',
            email: githubAccount.emailAddress || undefined,
          };
          console.log('GitHub account detected:', githubAccount.username);
        }

        console.log('User data for Convex:', userData);

        const result = await upsertUser(userData);
        console.log('User initialized in Convex database:', user.id, result);

        // If GitHub account is newly detected, fetch the OAuth token
        if (githubAccount && processedGithubAccountRef.current !== githubAccount.id) {
          console.log('New GitHub account detected, fetching OAuth token...');
          processedGithubAccountRef.current = githubAccount.id;

          try {
            // Fetch the GitHub OAuth token from Clerk Backend API
            const refreshResult = await refreshGithubToken({ clerkUserId: user.id });

            if (refreshResult.success) {
              console.log('GitHub OAuth token fetched successfully');
            } else {
              console.warn('Failed to fetch GitHub OAuth token:', refreshResult.error);
              // Don't fail user init - token can be fetched later
            }
          } catch (tokenError) {
            console.warn('Error fetching GitHub OAuth token:', tokenError);
            // Don't fail user init - token can be fetched later during sync
          }
        }
      } catch (error) {
        console.error('Failed to initialize user in Convex:', error);
        // Don't throw - let the app continue, user can try again
      }
    };

    initializeUser();
  }, [user, isLoaded, upsertUser, linkGithubAccount, refreshGithubToken]);

  // This component doesn't render anything
  return null;
};

export default UserInitializer;