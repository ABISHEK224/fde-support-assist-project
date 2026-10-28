export type Policy = {
  id: string;
  title: string;
  passages: string;
  suggestedReply: string;
};

export const policies: Policy[] = [
  {
    id: "shipping",
    title: "Shipping",
    passages: "Standard orders usually arrive within 5-7 business days.",
    suggestedReply:
      "Standard delivery usually takes 5-7 business days. If you share your order number, I can help check its status.",
  },
  {
    id: "returns",
    title: "Returns",
    passages:
      "Items can be returned within 30 days of delivery, if they are unused and in their original packaging.",
    suggestedReply:
      "You can return an unused item in its original packaging within 30 days of delivery.",
  },
  {
    id: "damaged",
    title: "Damaged items",
    passages:
      "If an item arrives damaged, contact support within 7 days of delivery and include a photo of the damage.",
    suggestedReply:
      "I'm sorry your item arrived damaged. Please contact support within 7 days of delivery and include a photo so we can help.",
  },
];
