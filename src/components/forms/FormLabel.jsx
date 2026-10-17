export function FormLabel({ className = '', children, ...props }) {
  return (
    <label
      {...props}
      className={`mb-xs block text-sm font-medium text-text-base ${className}`}
    >
      {children}
    </label>
  );
}
