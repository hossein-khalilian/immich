<script lang="ts">
  import { goto } from '$app/navigation';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { AppRoute } from '$lib/constants';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
  import { serverConfigManager } from '$lib/managers/server-config-manager.svelte';
  import { oauth } from '$lib/utils';
  import { getServerErrorMessage, handleError } from '$lib/utils/handle-error';
  import { login, type LoginResponseDto } from '@immich/sdk';
  import { Alert, Button, Field, Input, PasswordInput, Stack } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { lang } from '$lib/stores/preferences.store';
  import { get } from 'svelte/store';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let errorMessage: string = $state('');
  let email = $state('');
  let password = $state('');
  let oauthError = $state('');
  let loading = $state(false);
  let oauthLoading = $state(true);

  const serverConfig = $derived(serverConfigManager.value);

  // Translate login page message to Persian
  function translateLoginMessage(message: string): string {
    // Get current language
    const currentLang = get(lang);
    if (currentLang !== 'fa') {
      return message; // Return original if not Persian
    }

    // Translate demo instance messages
    let translated = message
      .replace(
        /This is a demo instance of Immich\. It is regularly reset\./g,
        'این یک نمونه نمایشی از Immich است. به صورت منظم ریست می‌شود.'
      )
      .replace(
        /Due to abuse, uploads to this instance are disabled\./g,
        'به دلیل سوء استفاده، امکان آپلود در این نمونه غیرفعال شده است.'
      );

    // Replace link with clickable element that has a data attribute for event handling
    translated = translated.replace(
      /<a[^>]*>Login as demo user<\/a>/gi,
      '<a href="#" class="demo-login-link" data-demo-login="true" style="cursor: pointer; text-decoration: underline;">ورود به عنوان کاربر دمو</a>'
    );
    
    // Also handle plain text version
    translated = translated.replace(/Login as demo user/g, 'ورود به عنوان کاربر دمو');

    return translated;
  }

  // Translate server error messages to Persian
  function translateErrorMessage(message: string | undefined): string {
    const currentLang = get(lang);
    if (currentLang !== 'fa' || !message) {
      return message || $t('errors.incorrect_email_or_password');
    }

    // Map common server error messages to translation keys
    const errorMap: Record<string, string> = {
      'Incorrect email or password': $t('errors.incorrect_email_or_password'),
      'incorrect email or password': $t('errors.incorrect_email_or_password'),
      'Incorrect Email Or Password': $t('errors.incorrect_email_or_password'),
    };

    // Check if message matches any known error
    const translated = errorMap[message] || errorMap[message.toLowerCase()];
    if (translated) {
      return translated;
    }

    // If no match found, try to use translation key if message looks like a translation key
    if (message.includes('errors.')) {
      return $t(message as any);
    }

    // Otherwise return fallback translation
    return $t('errors.incorrect_email_or_password');
  }

  const onSuccess = async (user: LoginResponseDto) => {
    await goto(data.continueUrl, { invalidateAll: true });
    eventManager.emit('AuthLogin', user);
  };

  const onFirstLogin = () => goto(AppRoute.AUTH_CHANGE_PASSWORD);
  const onOnboarding = () => goto(AppRoute.AUTH_ONBOARDING);

  onMount(async () => {
    // Add event listener for demo login link
    const handleDemoLinkClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('.demo-login-link');
      if (link) {
        event.preventDefault();
        handleDemoLogin();
      }
    };

    // Use event delegation on document
    document.addEventListener('click', handleDemoLinkClick);

    if (!featureFlagsManager.value.oauth) {
      oauthLoading = false;
      return () => {
        document.removeEventListener('click', handleDemoLinkClick);
      };
    }

    if (oauth.isCallback(globalThis.location)) {
      try {
        const user = await oauth.login(globalThis.location);

        if (!user.isOnboarded) {
          await onOnboarding();
          return () => {
            document.removeEventListener('click', handleDemoLinkClick);
          };
        }

        await onSuccess(user);
        return () => {
          document.removeEventListener('click', handleDemoLinkClick);
        };
      } catch (error) {
        console.error('Error [login-form] [oauth.callback]', error);
        oauthError = getServerErrorMessage(error) || $t('errors.unable_to_complete_oauth_login');
        oauthLoading = false;
        return () => {
          document.removeEventListener('click', handleDemoLinkClick);
        };
      }
    }

    try {
      if (
        (featureFlagsManager.value.oauthAutoLaunch && !oauth.isAutoLaunchDisabled(globalThis.location)) ||
        oauth.isAutoLaunchEnabled(globalThis.location)
      ) {
        await goto(`${AppRoute.AUTH_LOGIN}?autoLaunch=0`, { replaceState: true });
        await oauth.authorize(globalThis.location);
        return () => {
          document.removeEventListener('click', handleDemoLinkClick);
        };
      }
    } catch (error) {
      handleError(error, $t('errors.unable_to_connect'));
    }

    oauthLoading = false;

    // Cleanup on unmount
    return () => {
      document.removeEventListener('click', handleDemoLinkClick);
    };
  });

  const handleLogin = async () => {
    try {
      errorMessage = '';
      loading = true;
      const user = await login({ loginCredentialDto: { email, password } });

      if (user.isAdmin && !serverConfig.isOnboarded) {
        await onOnboarding();
        return;
      }

      // change the user password before we onboard them
      if (!user.isAdmin && user.shouldChangePassword) {
        await onFirstLogin();
        return;
      }

      // We want to onboard after the first login since their password will change
      // and handleLogin will be called again (relogin). We then do onboarding on that next call.
      if (!user.isOnboarded) {
        await onOnboarding();
        return;
      }

      await onSuccess(user);
      return;
    } catch (error) {
      const serverError = getServerErrorMessage(error);
      errorMessage = translateErrorMessage(serverError);
      loading = false;
      return;
    }
  };

  const handleOAuthLogin = async () => {
    oauthLoading = true;
    oauthError = '';
    const success = await oauth.authorize(globalThis.location);
    if (!success) {
      oauthLoading = false;
      oauthError = $t('errors.unable_to_login_with_oauth');
    }
  };

  const onsubmit = async (event: Event) => {
    event.preventDefault();
    await handleLogin();
  };

  // Handle demo user login
  const handleDemoLogin = async () => {
    email = 'demo@immich.app';
    password = 'demo';
    errorMessage = '';
    await handleLogin();
  };
</script>

<AuthPageLayout title={data.meta.title}>
  <Stack gap={4}>
    {#if serverConfig.loginPageMessage}
      <Alert color="primary" class="mb-6">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html translateLoginMessage(serverConfig.loginPageMessage)}
      </Alert>
    {/if}

    {#if !oauthLoading && featureFlagsManager.value.passwordLogin}
      <form {onsubmit} class="flex flex-col gap-4">
        {#if errorMessage}
          <Alert color="danger" title={errorMessage} closable />
        {/if}

        <Field label={$t('email')}>
          <Input id="email" name="email" type="email" autocomplete="email" bind:value={email} />
        </Field>

        <Field label={$t('password')}>
          <PasswordInput id="password" bind:value={password} autocomplete="current-password" />
        </Field>

        <Button type="submit" size="large" shape="round" fullWidth {loading} class="mt-6">{$t('to_login')}</Button>
      </form>
    {/if}

    {#if featureFlagsManager.value.oauth}
      {#if featureFlagsManager.value.passwordLogin}
        <div class="inline-flex w-full items-center justify-center my-4">
          <hr class="my-4 h-px w-3/4 border-0 bg-gray-200 dark:bg-gray-600" />
          <span
            class="absolute start-1/2 -translate-x-1/2 bg-gray-50 px-3 font-medium text-gray-900 dark:bg-neutral-900 dark:text-white uppercase"
          >
            {$t('or')}
          </span>
        </div>
      {/if}
      {#if oauthError}
        <Alert color="danger" title={oauthError} closable />
      {/if}
      <Button
        shape="round"
        loading={loading || oauthLoading}
        disabled={loading || oauthLoading}
        size="large"
        fullWidth
        color={featureFlagsManager.value.passwordLogin ? 'secondary' : 'primary'}
        onclick={handleOAuthLogin}
      >
        {serverConfig.oauthButtonText}
      </Button>
    {/if}

    {#if !featureFlagsManager.value.passwordLogin && !featureFlagsManager.value.oauth}
      <Alert color="warning" title={$t('login_has_been_disabled')} />
    {/if}
  </Stack>
</AuthPageLayout>
