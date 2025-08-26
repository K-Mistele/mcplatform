const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--window-size=1920,1080'],
    userDataDir: '/Users/kyle/Library/Application Support/Google/Chrome/Default'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Listen for console messages
  page.on('console', msg => {
    console.log('Console:', msg.type(), '-', msg.text());
  });

  // Listen for page errors
  page.on('pageerror', err => {
    console.error('Page Error:', err.message);
  });

  try {
    console.log('Trying to go directly to dashboard...');
    await page.goto('http://localhost:3000/dashboard', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const currentUrl = page.url();
    console.log('Current URL after dashboard attempt:', currentUrl);
    
    // If we're redirected to login, try the auto-login
    if (currentUrl.includes('login') || currentUrl.includes('auth')) {
      console.log('Redirected to login, trying auto-login...');
      await page.goto('http://localhost:3000/login-for-claude', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for auto-login
      
      // Navigate to dashboard
      await page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Current URL after auto-login and dashboard navigation:', page.url());
    }

    console.log('Looking for Team navigation item...');
    
    // First, let's see what's on the page
    console.log('Page title:', await page.title());
    
    // Check for any navigation elements
    const navElements = await page.$$('nav, [role="navigation"], .sidebar, aside');
    console.log('Found navigation elements:', navElements.length);
    
    // Check all links on the page
    console.log('Looking for all links on the page...');
    const allLinks = await page.$$eval('a', links => 
      links.map(link => ({ href: link.href, text: link.textContent?.trim() }))
    );
    console.log('Available links:', allLinks);
    
    // Look for Team link in navigation by href
    let teamLink = await page.$('a[href="/team"]');
    
    if (!teamLink) {
      // Try to find any link with "team" in the text
      const allLinksElements = await page.$$('a');
      for (const link of allLinksElements) {
        const text = await page.evaluate(el => el.textContent, link);
        if (text && text.toLowerCase().includes('team')) {
          console.log('Found team link by text content:', text);
          teamLink = link;
          break;
        }
      }
    }
    
    if (teamLink) {
      console.log('Clicking Team navigation...');
      await teamLink.click();
      
      console.log('Waiting for team page to load...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('Team navigation not found');
    }
    
    // Take screenshot of current state
    console.log('Taking screenshot of current page...');
    await page.screenshot({ 
      path: 'team-page-screenshot.png', 
      fullPage: true 
    });
    
    console.log('Checking current URL...');
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // Look for Invite Member button
    console.log('Looking for Invite Member button...');
    const buttons = await page.$$('button');
    let inviteButton = null;
    
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.toLowerCase().includes('invite')) {
        console.log('Found invite button with text:', text);
        inviteButton = button;
        break;
      }
    }
    
    if (!inviteButton) {
      console.log('Invite Member button not found, checking all buttons...');
      const buttonTexts = await page.$$eval('button', buttons => 
        buttons.map(btn => btn.textContent?.trim()).filter(text => text)
      );
      console.log('Available buttons:', buttonTexts);
    } else {
      console.log('Found Invite Member button, clicking...');
      await inviteButton.click();
      
      console.log('Waiting for dialog to open...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Take screenshot of dialog
      console.log('Taking screenshot of invite dialog...');
      await page.screenshot({ 
        path: 'invite-dialog-screenshot.png', 
        fullPage: true 
      });
    }

    console.log('Test completed successfully');

  } catch (error) {
    console.error('Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'error-screenshot.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();