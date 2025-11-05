export default {
  create(context) {
    return [
      { name: 'created-entry', title: `Created ${context.label ?? 'item'}` },
      { title: 'Unnamed entry' }
    ];
  }
};
