import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export async function POST(request: NextRequest) {
  try {
    const { productUrl } = await request.json();
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(productUrl);
    
    const images = await page.evaluate(() => {
      const imgElements = document.querySelectorAll('img');
      return Array.from(imgElements).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight
      }));
    });
    
    await browser.close();
    
    // Filter for main product images
    const productImages = images.filter(img => 
      img.width > 300 && 
      img.height > 300 && 
      !img.src.includes('logo') && 
      !img.src.includes('icon')
    );
    
    return NextResponse.json({ 
      success: true, 
      images: productImages 
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to scrape images' }, { status: 500 });
  }
}
