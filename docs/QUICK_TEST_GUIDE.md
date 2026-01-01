# Quick Test Guide - Product Comparison Feature

## 🚀 Quick Start (5 Minutes)

### Step 1: Reload Extension
```bash
1. Open Chrome
2. Go to chrome://extensions/
3. Find "Retail Agent"
4. Click the refresh/reload icon 🔄
```

### Step 2: Open Extension
```bash
1. Click the Retail Agent icon in Chrome toolbar
2. If prompted, enter your Gemini API Key in Settings
```

### Step 3: Test Basic Comparison
**Query to try:**
```
compare samsung phone 5000mah battery 6gb ram under 20000
```

**Expected behavior:**
1. ✅ Extension says "Comparing prices across Amazon and Flipkart..."
2. ✅ Two tabs open (Amazon and Flipkart) in background
3. ✅ Searches execute on both platforms
4. ✅ Comparison card appears showing:
   - Total products found
   - Best deal (highlighted in green)
   - Price, rating, delivery for best product
   - Reason why it's best
   - Savings amount
   - All other options ranked with medals 🥇🥈🥉
5. ✅ Extension auto-selects best product
6. ✅ Navigates to product page
7. ✅ Closes unused platform tab
8. ✅ Proceeds with "Buy Now"

---

## 🧪 Test Cases

### Test 1: Comparison with "compare" keyword
```
Query: "compare samsung phone under 20000"
Expected: Comparison mode activates
```

### Test 2: Comparison with "best price" keyword
```
Query: "best price for oneplus nord"
Expected: Comparison mode activates
```

### Test 3: Comparison with "which is better" keyword
```
Query: "which is better deal - iphone 13 amazon or flipkart"
Expected: Comparison mode activates
```

### Test 4: Single platform (no comparison)
```
Query: "buy samsung phone on amazon"
Expected: Only Amazon opens, no comparison
```

### Test 5: Adjust preferences
```
1. Open Settings (⚙️)
2. Scroll to "Comparison Preferences"
3. Set Price slider to 80%
4. Set Rating slider to 10%
5. Save
6. Try: "compare laptops 16gb ram"
Expected: Cheapest laptop wins even if lower rating
```

---

## 📊 What to Look For

### ✅ Success Indicators:
- [ ] Comparison card appears with gradient header
- [ ] Best deal section is highlighted in green
- [ ] All products are ranked (🥇🥈🥉)
- [ ] Savings amount is shown
- [ ] Reason for recommendation is clear
- [ ] Icons display correctly (💰⭐🚚)
- [ ] Auto-selection works
- [ ] Unused tabs close automatically

### ❌ Common Issues & Fixes:

**Issue**: "No products found"
- **Fix**: Try simpler query like "compare samsung phone"

**Issue**: Only one platform opens
- **Fix**: Make sure query includes comparison keywords

**Issue**: Comparison card doesn't show
- **Fix**: Check browser console for errors (F12)

**Issue**: Settings sliders not saving
- **Fix**: Make sure you click "Save" button

---

## 🎯 Quick Comparison Queries to Copy-Paste

```
1. compare samsung phone 5000mah battery 6gb ram under 20000
2. which is better deal - iphone 13 amazon or flipkart  
3. best price for oneplus nord
4. compare laptops 16gb ram under 50000
5. find me best tablet deal
6. which platform has cheapest samsung tv?
7. compare sony headphones under 5000
8. best deal for gaming mouse
```

---

## 🔧 Troubleshooting

### Extension Not Working?
1. Check Gemini API Key is set
2. Check API key has quota remaining
3. Check console for errors (F12 → Console tab)
4. Try reloading extension

### Comparison Not Activating?
1. Use comparison keywords: "compare", "best price", "which is better"
2. Check LLM is working (should see "Analyzing your request...")
3. Try explicit query: "compare [product] amazon flipkart"

### Products Not Extracting?
1. Wait 5-10 seconds for pages to fully load
2. Check network connection
3. Check if Amazon/Flipkart are accessible
4. Try simpler product query

### Comparison Card Not Displaying?
1. Check popup console for JavaScript errors
2. Make sure both platforms returned products
3. Try refreshing extension popup

---

## 📝 Test Results Template

Copy this and fill in your results:

```
Date: _____________
Extension Version: _____________

Test 1: Basic Comparison
Query: "compare samsung phone under 20000"
✅ / ❌ Result: __________________
Notes: _________________________

Test 2: Price-Focused
Settings: Price 80%, Rating 10%
Query: "compare laptops"
✅ / ❌ Result: __________________
Notes: _________________________

Test 3: Quality-Focused
Settings: Rating 60%, Price 20%
Query: "compare headphones"
✅ / ❌ Result: __________________
Notes: _________________________

Overall: ✅ / ❌
Issues Found: __________________
```

---

## 🎉 Success!

If you see this after running a comparison query:

```
📊 Product Comparison
━━━━━━━━━━━━━━━━━━━━
Found 12 products across amazon, flipkart

✅ Best Deal: AMAZON
Samsung Galaxy F05
💰 Price: ₹8,999
⭐ Rating: 4.2/5
🚚 Delivery: Tomorrow

Why? Lowest price, Fast delivery, In stock
💵 Save ₹1,500 (14.3%)
```

**Then the feature is working perfectly!** 🎊

---

## 📞 Need Help?

Check these files:
- `COMPARISON_FEATURE_COMPLETE.md` - Full documentation
- `COMPARISON_FEATURE_PROGRESS.md` - Implementation details
- Console logs (F12) - For debugging

**Happy Shopping! 🛒✨**

