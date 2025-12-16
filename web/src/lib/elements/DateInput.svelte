<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { lang } from '$lib/stores/preferences.store';
  import { gregorianToJalali, jalaliToGregorian } from '$lib/utils/jalali-converter';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';

  interface Props extends HTMLInputAttributes {
    type: 'date' | 'datetime-local';
    value?: string;
    min?: string;
    max?: string;
    class?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    autofocus?: boolean;
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let { type, value = $bindable(), max = undefined, min = undefined, onkeydown, id, ...rest }: Props = $props();

  let fallbackMax = $derived(type === 'date' ? '9999-12-31' : '9999-12-31T23:59');
  let fallbackMin = $derived(type === 'date' ? '1900-01-01' : '1900-01-01T00:00');

  // Updating `value` directly causes the date input to reset itself or
  // interfere with user changes.
  let updatedValue = $state('');
  let inputElement: HTMLInputElement | null = $state(null);
  let isPersian = $derived(get(lang) === 'fa');
  
  // Sync updatedValue with value prop - convert Gregorian to Jalali for display
  $effect(() => {
    if (isPersian && type === 'date') {
      if (value) {
        try {
          // Extract date part if it's an ISO string (e.g., "2025-12-13T00:00:00.000Z" -> "2025-12-13")
          let datePart = value.split('T')[0];
          
          // Check if value is in Gregorian format (YYYY-MM-DD)
          if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
            updatedValue = gregorianToJalali(datePart);
          } else if (datePart.includes('/')) {
            // Already Jalali format
            updatedValue = datePart;
          } else {
            updatedValue = value;
          }
        } catch (error) {
          console.error('Error converting Gregorian to Jalali:', error);
          updatedValue = value;
        }
      } else {
        updatedValue = '';
      }
    } else {
      updatedValue = value || '';
    }
  });
  
  // Watch for value changes and update JalaliDatePicker display when value changes (e.g., after search)
  $effect(() => {
    if (isPersian && inputElement && type === 'date') {
      const jalaliDatepicker = (window as any).jalaliDatepicker;
      if (!jalaliDatepicker) {
        return;
      }
      
      // When value changes (e.g., from server), update JalaliDatePicker
      if (updatedValue) {
        // Update the input element value if it's different
        if (inputElement.value !== updatedValue) {
          inputElement.value = updatedValue;
          
          // Update JalaliDatePicker with new value - use setTimeout to ensure it's ready
          setTimeout(() => {
            if (inputElement && jalaliDatepicker) {
              try {
                if (typeof jalaliDatepicker.setValue === 'function') {
                  jalaliDatepicker.setValue(inputElement, updatedValue);
                } else if (typeof jalaliDatepicker.start === 'function') {
                  // Re-initialize if setValue doesn't work
                  jalaliDatepicker.start(inputElement, { initDate: updatedValue });
                }
              } catch (error) {
                // Silently fail
              }
            }
          }, 100);
        }
      } else {
        // Clear value
        if (inputElement.value) {
          inputElement.value = '';
          setTimeout(() => {
            try {
              if (inputElement && jalaliDatepicker && typeof jalaliDatepicker.setValue === 'function') {
                jalaliDatepicker.setValue(inputElement, '');
              }
            } catch (error) {
              // Silently fail
            }
          }, 100);
        }
      }
    }
  });

  // Initialize JalaliDatePicker for Persian language
  onMount(() => {
    if (isPersian && inputElement && type === 'date') {
      // Wait for jalaliDatepicker to load from CDN
      const initPicker = () => {
        const jalaliDatepicker = (window as any).jalaliDatepicker;
        if (!jalaliDatepicker) {
          return undefined;
        }

        // Convert Gregorian value to Jalali for display
        let initialValue = '';
        if (value) {
          // Check if value is already in Jalali format or Gregorian
          if (value.includes('/')) {
            // Already Jalali
            initialValue = value;
          } else if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
            // Gregorian format, convert to Jalali
            initialValue = gregorianToJalali(value);
          } else {
            initialValue = value;
          }
          inputElement!.value = initialValue;
        }
        
        // Convert min/max dates to Jalali
        // Don't set restrictive min/max unless explicitly provided
        let minDate: string | null = null;
        let maxDate: string | null = null;
        
        if (min) {
          minDate = gregorianToJalali(min);
        }
        if (max) {
          maxDate = gregorianToJalali(max);
        }
        
        // Set data attributes for JalaliDatePicker only if explicitly provided
        if (minDate) {
          inputElement!.setAttribute('data-jdp-min-date', minDate);
        }
        if (maxDate) {
          inputElement!.setAttribute('data-jdp-max-date', maxDate);
        }
        
        // Configure JalaliDatePicker options
        // Don't set restrictive min/max dates by default - let JalaliDatePicker use its defaults
        const pickerOptions: any = {
          autoShow: true,
          autoHide: true, // Allow hiding on outside click
          hideAfterChange: true, // Hide after selecting date for better UX
          placeholderText: rest.placeholder || 'تاریخ را انتخاب کنید',
          persianDigits: false,
          container: 'body', // Ensure datepicker is appended to body, not the input container
          zIndex: 99999, // Set high z-index
        };
        
        // Only add min/max if explicitly provided
        if (minDate) {
          pickerOptions.minDate = minDate;
        }
        if (maxDate) {
          pickerOptions.maxDate = maxDate;
        }
        
        // Always set initDate in pickerOptions if we have a value
        if (initialValue) {
          pickerOptions.initDate = initialValue;
          pickerOptions.value = initialValue; // Also set value property
        }
        
        // Use startWatch for auto-initialization (works with data-jdp attribute)
        // The data-jdp attribute enables auto-initialization
        try {
          // Initialize JalaliDatePicker explicitly on this element
          if (typeof jalaliDatepicker.start === 'function') {
            // Use start method to initialize with options
            jalaliDatepicker.start(inputElement, pickerOptions);
          } else if (typeof jalaliDatepicker.startWatch === 'function') {
            // Fallback to startWatch for global initialization
            jalaliDatepicker.startWatch(pickerOptions);
          } else {
            // Fallback: just use the data-jdp attribute and let auto-initialization work
            // JalaliDatePicker will auto-initialize elements with data-jdp attribute
            console.log('JalaliDatePicker: Using data-jdp auto-initialization');
          }
          
          // Ensure value is set after a short delay to allow initialization
          if (initialValue) {
            setTimeout(() => {
              if (inputElement && jalaliDatepicker) {
                try {
                  // Try multiple methods to set the value
                  if (typeof jalaliDatepicker.setValue === 'function') {
                    jalaliDatepicker.setValue(inputElement, initialValue);
                  }
                  // Also ensure input element has the value
                  if (inputElement.value !== initialValue) {
                    inputElement.value = initialValue;
                  }
                } catch (error) {
                  // Silently fail
                }
              }
            }, 150);
          }
        } catch (error) {
          console.error('Error initializing JalaliDatePicker:', error);
          // Continue anyway - data-jdp might still work
        }
        
        // Listen for date changes - only convert when JalaliDatePicker sets the value
        // Don't interfere with JalaliDatePicker's internal handling
        const handleChange = () => {
          if (!inputElement) return;
          const jalaliValue = inputElement.value;
          if (jalaliValue && jalaliValue.includes('/')) {
            // Convert Jalali to Gregorian and update the bindable value
            // But don't update the input field value - let JalaliDatePicker manage it
            try {
              const gregorianValue = jalaliToGregorian(jalaliValue);
              value = gregorianValue;
              // Don't update updatedValue here - it will conflict with JalaliDatePicker
            } catch (error) {
              console.error('Error converting Jalali to Gregorian:', error);
            }
          }
        };
        
        // Only listen to change event once - don't add multiple listeners
        inputElement!.addEventListener('change', handleChange, { once: false });
        
        return () => {
          // Cleanup when component is destroyed
          if (inputElement) {
            inputElement.removeEventListener('change', handleChange);
            if (jalaliDatepicker) {
              try {
                if (typeof jalaliDatepicker.endWatch === 'function') {
                  jalaliDatepicker.endWatch(inputElement);
                } else if (typeof jalaliDatepicker.end === 'function') {
                  jalaliDatepicker.end(inputElement);
                }
              } catch (error) {
                console.error('Error ending JalaliDatePicker:', error);
              }
            }
          }
        };
      };
      
      // Try immediately, or wait for script to load
      let cleanup = initPicker();
      if (!cleanup) {
        // Wait for script to load
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        const checkInterval = setInterval(() => {
          attempts++;
          cleanup = initPicker();
          if (cleanup || attempts >= maxAttempts) {
            clearInterval(checkInterval);
          }
        }, 100);
        
        return () => {
          clearInterval(checkInterval);
          if (cleanup) cleanup();
        };
      }
      
      return cleanup;
    }
    
    if (isPersian && inputElement && type === 'datetime-local') {
      // For datetime-local, we still use native input but convert display
      // This is a simplified approach - full datetime picker would need more work
      if (value) {
        const [datePart, timePart] = value.split('T');
        if (datePart) {
          const jalaliDate = gregorianToJalali(datePart);
          inputElement.value = `${jalaliDate}T${timePart || '00:00'}`;
        }
      }
      
      const handleDatetimeChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const inputValue = target.value;
        if (inputValue) {
          // Try to parse as Jalali datetime and convert
          const parts = inputValue.split('T');
          if (parts[0] && parts[0].includes('/')) {
            // It's Jalali format, convert to Gregorian
            const gregorianDate = jalaliToGregorian(parts[0]);
            value = `${gregorianDate}T${parts[1] || '00:00'}`;
            updatedValue = value;
          } else {
            // It's already Gregorian
            value = inputValue;
            updatedValue = inputValue;
          }
        }
      };
      
      inputElement.addEventListener('change', handleDatetimeChange);
      
      return () => {
        if (inputElement) {
          inputElement.removeEventListener('change', handleDatetimeChange);
        }
      };
    }
  });
</script>

{#if isPersian && type === 'date'}
  <input
    bind:this={inputElement}
    {...rest}
    type="text"
    {id}
    data-jdp
    value={updatedValue}
    onblur={() => {
      // Don't interfere with JalaliDatePicker - let it handle the value
      // Only sync the bindable value if needed
      if (inputElement && inputElement.value && inputElement.value.includes('/')) {
        try {
          const gregorianValue = jalaliToGregorian(inputElement.value);
          value = gregorianValue;
          updatedValue = inputElement.value;
        } catch (error) {
          console.error('Error converting Jalali to Gregorian on blur:', error);
        }
      }
    }}
    oninput={(e) => {
      // Update updatedValue when user types
      updatedValue = e.currentTarget.value;
    }}
    onkeydown={(e) => {
      onkeydown?.(e);
    }}
  />
{:else}
  <input
    bind:this={inputElement}
    {...rest}
    {type}
    {id}
    bind:value
    max={max || fallbackMax}
    min={min || fallbackMin}
    oninput={(e) => (updatedValue = e.currentTarget.value)}
    onblur={() => (value = updatedValue)}
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        value = updatedValue;
      }
      onkeydown?.(e);
    }}
    step=".001"
  />
{/if}