// Flat, single-color icon set for household tasks. Every icon is a single
// currentColor fill, no gradients/strokes/multi-color -- keep any additions
// in this same style rather than mixing icon treatments.

function Icon({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...props}>
      {children}
    </svg>
  );
}

const ICONS = {
  cleaning: (props) => (
    <Icon {...props}>
      <path d="M14 2a1 1 0 0 1 1 1v6.6l3.4 8.1a2 2 0 0 1-1.8 2.8H9.4a2 2 0 0 1-1.8-2.8L11 9.6V3a1 1 0 0 1 1-1h2Zm-1 2h-0v5.8L9.3 18.5h5.4L13 9.8V4Z" />
    </Icon>
  ),
  trash: (props) => (
    <Icon {...props}>
      <path d="M9 3a1 1 0 0 0-1 1v1H5v2h1v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1V5h-3V4a1 1 0 0 0-1-1H9Zm-1 4h8v12H8V7Zm2 2v8h1.4V9H10Zm3.6 0v8H15V9h-1.4Z" />
    </Icon>
  ),
  coffee: (props) => (
    <Icon {...props}>
      <path d="M4 3h13v2h1a3 3 0 0 1 0 6h-1.2A6 6 0 0 1 11 17H8a6 6 0 0 1-6-6V4a1 1 0 0 1 1-1Zm2 2v6a4 4 0 0 0 4 4h3a4 4 0 0 0 4-4V5H6Zm11 2v4a3 3 0 0 0 0-4ZM4 19h13v2H4v-2Z" />
    </Icon>
  ),
  laundry: (props) => (
    <Icon {...props}>
      <path d="M9 2 7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2l-2-2H9Zm3 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </Icon>
  ),
  dishes: (props) => (
    <Icon {...props}>
      <path d="M2 10a10 10 0 0 1 20 0 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Zm0 4h20v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1Zm3 4h14l-1.2 3.2a1 1 0 0 1-.94.8H7.14a1 1 0 0 1-.94-.8L5 18Z" />
    </Icon>
  ),
  vacuum: (props) => (
    <Icon {...props}>
      <path d="M12 3a7 7 0 0 1 7 7 7 7 0 0 1-3 5.74V19h2v2H6v-2h2v-3.26A7 7 0 0 1 5 10a7 7 0 0 1 7-7Zm0 2a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
    </Icon>
  ),
  shopping: (props) => (
    <Icon {...props}>
      <path d="M7 2 4.6 6H2v2h1.4l2 10.4A2 2 0 0 0 7.36 20H18a1 1 0 0 0 0-2H7.36l-.4-2H19a1 1 0 0 0 .96-.72L22 8H6.86L7 7.4 8.4 5H19V3H8Zm0 19a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </Icon>
  ),
  plant: (props) => (
    <Icon {...props}>
      <path d="M12 2c3 3 4 6 2.6 9.2A5 5 0 0 1 13 21h-2a5 5 0 0 1-1.6-9.8C8 8 9 5 12 2Zm-1 10.2A3 3 0 0 0 11 19h.1c.6-2.7-.2-4.9-.1-6.8Z" />
      <path d="M4 13a5 5 0 0 0 5 5h1v-2H9a3 3 0 0 1-3-3v-1H4v1Zm16 0v-1h-2v1a3 3 0 0 1-3 3h-1v2h1a5 5 0 0 0 5-5Z" />
    </Icon>
  ),
  pet: (props) => (
    <Icon {...props}>
      <circle cx="12" cy="16" r="4" />
      <circle cx="5.5" cy="10" r="2" />
      <circle cx="18.5" cy="10" r="2" />
      <circle cx="9" cy="5.5" r="2" />
      <circle cx="15" cy="5.5" r="2" />
    </Icon>
  ),
  tool: (props) => (
    <Icon {...props}>
      <path d="M21.7 16.6 15 9.9a5 5 0 0 0-6-6.6L11.6 6l-.7 2.9L8 9.6 5.3 7 2.7 9.6a5 5 0 0 0 6.6 6l6.7 6.7a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4Z" />
    </Icon>
  ),
  bed: (props) => (
    <Icon {...props}>
      <path d="M3 6a1 1 0 0 1 1 1v3.2A3 3 0 0 1 6 10h6a3 3 0 0 1 2.8 2H16a3 3 0 0 1 3 3v3h-2v-2H5v2H3V6Zm3 6a1 1 0 0 0-1 1v1h6v-1a1 1 0 0 0-1-1H6Zm12-8a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    </Icon>
  ),
  other: (props) => (
    <Icon {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-3.6h-2c0-3 2.6-2.7 2.6-4.7 0-1-.9-1.7-2-1.7-.9 0-1.7.5-1.9 1.3l-1.8-.8C8.3 6.2 9.9 5 12 5c2.2 0 4 1.5 4 3.6 0 2.4-2.6 2.6-3 4.8Z" />
    </Icon>
  ),
  calendar: (props) => (
    <Icon {...props}>
      <path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7ZM5 9h14v11H5V9Zm2 3v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z" />
    </Icon>
  ),
};

export const TASK_ICON_KEYS = Object.keys(ICONS);

export default function TaskIcon({ icon, className = '', ...props }) {
  const Component = ICONS[icon] || ICONS.other;
  return <Component className={className} {...props} />;
}
