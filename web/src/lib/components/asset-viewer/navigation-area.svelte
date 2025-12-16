<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    onClick: (e: MouseEvent) => void;
    label: string;
    children?: Snippet;
  }

  let { onClick, label, children }: Props = $props();
</script>

<button
  type="button"
  class="my-auto mx-4 rounded-full p-3 text-gray-500 transition hover:bg-gray-500 hover:text-white navigation-area-button"
  aria-label={label}
  onclick={onClick}
>
  {@render children?.()}
</button>

<style>
  /* Flip navigation icons in RTL */
  :global([dir='rtl']) .navigation-area-button :global(svg) {
    transform: scaleX(-1);
  }
</style>
